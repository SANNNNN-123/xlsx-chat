import os
from dotenv import load_dotenv
from supabase import create_client
from openai import OpenAI  
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Union
import uvicorn

# Initialize FastAPI app
app = FastAPI(
    title="XLSX-Chat",
    description="API for XLSX-Chat",
    version="1.0.0"
)

# Load environment variables
load_dotenv()

# Update CORS middleware with proper frontend URL
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models for request/response
class QueryRequest(BaseModel):
    query: str

class QueryResponse(BaseModel):
    response: str

class ValidationResponse(BaseModel):
    is_valid: bool
    message: Optional[str] = None
    similar_questions: Optional[List[str]] = None

class ValidationAgent:
    def __init__(self):
        load_dotenv()
        # Initialize Supabase client
        self.supabase = create_client(
            os.getenv('SUPABASE_URL'),
            os.getenv('SUPABASE_KEY')
        )
        # Initialize OpenAI client
        self.client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
        self.model = "gpt-4"  # Using GPT-4 model
        # Initialize Gemini
        #genai.configure(api_key=os.getenv('GOOGLE_API_KEY'))
        #self.model = genai.GenerativeModel('gemini-2.0-flash-thinking-exp-01-21')

    def find_similar_questions(self, question_id):
        try:
            # Convert to uppercase for consistency
            question_id = question_id.upper()
            
            # Search for similar question IDs including sub_questions
            result = self.supabase.table('survey_responses') \
                .select('question_id', 'sub_question') \
                .or_(
                    f"question_id.ilike.%{question_id}%," + 
                    f"sub_question.ilike.%{question_id}%"
                ) \
                .is_not('sub_question', '') \
                .execute()
            
            # Get unique combinations of question_id and sub_question
            unique_questions = set()
            for item in result.data:
                qid = item['question_id']
                sub_q = item['sub_question']
                
                # Add the base question ID
                unique_questions.add(qid)
                
                # If there's a sub_question, add the combined format
                if sub_q:
                    combined = f"{qid} (sub: {sub_q})"
                    unique_questions.add(combined)
                
                # If it's a grid question, also suggest the base version
                if '[' in qid:
                    base_version = qid.split('[')[0]
                    unique_questions.add(f"{base_version} (grid summary)")
                    
                # If it's a loop question (like S5S6_loop), suggest the base version
                if '_loop' in qid.lower():
                    base_version = qid.split('_')[0]
                    unique_questions.add(f"{base_version} (base)")
            
            return sorted(list(unique_questions))
            
        except Exception as e:
            print(f"Error finding similar questions: {e}")
            return []

    def validate_question(self, question_id):
        try:
            # Convert to uppercase for consistency
            question_id = question_id.upper()
            
            # Check for exact match in both question_id and sub_question
            result = self.supabase.table('survey_responses') \
                .select('question_id', 'sub_question') \
                .or_(
                    f"question_id.eq.{question_id}," +
                    f"question_id.ilike.%{question_id}%," +
                    f"sub_question.eq.{question_id}," +
                    f"sub_question.ilike.%{question_id}%"
                ) \
                .limit(1) \
                .execute()
            
            if len(result.data) > 0:
                return True, None
            
            # If no exact match, find similar questions
            similar_questions = self.find_similar_questions(question_id)
            if similar_questions:
                suggestion_msg = (
                    f"Question {question_id} not found. Did you mean one of these?\n" + 
                    "\n".join(f"- {q}" for q in similar_questions)
                )
                return False, suggestion_msg
            
            return False, f"Couldnt find similar. Question {question_id} not found in database"
            
        except Exception as e:
            print(f"Error checking question: {e}")
            return False, "Error validating question"

    def extract_operation_and_question(self, user_input):
        try:
            # Use LLM to extract both operation and question ID
            prompt = f"""
            Analyze the user input and extract the operation type and question ID.
            
            Operation types:
            1. "check" or "exist" - if asking about existence of a question
            2. "count" - if asking for counts/frequency
            3. "summary" or "grid" - if asking for grid summary
            4. "none" - if operation unclear or input is gibberish
            
            Question ID formats: S5, S5[1], S5S6_loop, Q1, resp_gender, race, etc.
            
            Return format: operation|question_id
            If input is unclear/gibberish or no question ID found, return: none|none
            
            Examples:
            "does s0 exist?" -> check|s0
            "what is count for s5s6_loop" -> count|s5s6_loop
            "show me grid summary of s5s6_loop" -> summary|s5s6_loop
            "hello how are you" -> none|none
            
            Input: {user_input}
            Output: """

            try:
                llm_response = self.client.chat.completions.create(
                    model=self.model,
                    messages=[{"role": "user", "content": prompt}]
                )
                result = llm_response.choices[0].message.content.strip()
                operation, question_id = result.split('|')
                print(f"LLM extracted - Operation: {operation}, Question ID: {question_id}")
                return operation.lower(), question_id

            except Exception as llm_e:
                print(f"LLM extraction failed: {llm_e}")
                return None, None

        except Exception as e:
            print(f"Error in operation and question extraction: {e}")
            return None, None

    def get_grid_variations(self, base_id):
        try:
            # Get all variations of the grid question, excluding those with open_ended
            result = self.supabase.table('survey_responses') \
                .select('question_id') \
                .ilike('question_id', f"{base_id}[%") \
                .is_('open_ended', 'null') \
                .execute()
            
            grid_variations = set()
            for item in result.data:
                if '[' in item['question_id'] and ']' in item['question_id']:
                    grid_variations.add(item['question_id'])
            
            return sorted(list(grid_variations))
        except Exception as e:
            print(f"Error finding grid variations: {e}")
            return []

    def process_query(self, user_input):
        try:
            # Extract operation and question ID
            operation, question_id = self.extract_operation_and_question(user_input)
            
            # Handle unclear/gibberish input
            if not operation or operation == 'none' or not question_id or question_id == 'none':
                return "Please specify your operation and variable"

            # Check if question exists using check_question_exists function
            existence_check = self.supabase.rpc(
                'check_question_exists',
                {'p_question_id': question_id}
            ).execute()

            if existence_check.data:
                does_exist = existence_check.data.get('exists_flag')
                similar_questions = existence_check.data.get('similar_questions', [])

                # Handle existence check operation
                if operation in ['check', 'exist']:
                    if does_exist:
                        return f"Yes, question {question_id} exists in the database."
                    else:
                        if similar_questions:
                            suggestion_msg = (
                                f"No, question {question_id} does not exist, but found these similar questions:\n" + 
                                "\n".join(f"- {q}" for q in sorted(similar_questions))
                            )
                            return suggestion_msg
                        return f"No, question {question_id} does not exist in database"

                # For summary/grid operations, directly get counts if it's a loop/grid question
                if operation.lower() in ['summary', 'grid'] and ('_loop' in question_id or '[' in question_id):
                    analytic_agent = BasicAnalyticAgent()
                    return analytic_agent.get_counts(question_id.split('[')[0])  # Pass base ID for summary

                # Handle other operations (count, summary) only if question exists
                if not does_exist:
                    if similar_questions:
                        suggestion_msg = (
                            f"Question {question_id} not found. Did you mean one of these?\n" + 
                            "\n".join(f"- {q}" for q in sorted(similar_questions))
                        )
                        return suggestion_msg
                    return f"Question {question_id} not found in database"

                # Question exists and operation is valid, forward to BasicAnalyticAgent
                if operation.lower() in ['count', 'summary']:
                    analytic_agent = BasicAnalyticAgent()
                    return analytic_agent.get_counts(question_id)
                else:
                    return f"Operation '{operation}' not supported. Available operations: count, summary, check"

            return "Error validating question"

        except:
            print(f"Error processing query:")
            return "I couldn't process that query. Please try again"

class BasicAnalyticAgent:
    def __init__(self):
        load_dotenv()
        self.supabase = create_client(
            os.getenv('SUPABASE_URL'),
            os.getenv('SUPABASE_KEY')
        )

    def get_counts(self, question_id, grid_type=None, grid_numbers=None):
        try:
            # Get question type - Modified to handle grid questions better
            base_id = question_id.split('[')[0] if '[' in question_id else question_id
            question_type_response = self.supabase.table('survey_responses') \
                .select('question_id', 'question_type') \
                .or_(
                    f"question_id.ilike.{base_id}[%]," +  # Match any grid variation
                    f"question_id.eq.{base_id}"           # Match exact base ID
                ) \
                .is_('open_ended', 'null') \
                .limit(1) \
                .execute()
            
            if not question_type_response.data:
                return "Question not found"
                
            # Get the question type from the response
            question_type = question_type_response.data[0]['question_type']
            
            # For GRID questions (summary view)
            if question_type == 'GRID':
                base_id = question_id.split('[')[0] if '[' in question_id else question_id
                
                # If it's a specific grid column (e.g. S5S6_loop[1])
                if '[' in question_id and ']' in question_id:
                    grid_num = question_id.split('[')[1].split(']')[0]
                    result = self.supabase.rpc(
                        'get_grid_question_counts',
                        {
                            'p_base_question_id': base_id,
                            'p_grid_numbers': [grid_num]
                        }
                    ).execute()
                else:
                    # For base grid questions (e.g. S5S6_loop), directly call RPC without fetching grid numbers
                    result = self.supabase.rpc(
                        'get_grid_question_counts',
                        {
                            'p_base_question_id': base_id,
                            'p_grid_numbers': []  # Empty array to get all grid variations
                        }
                    ).execute()

                if not result.data:
                    return "No data found"

                # Improved output formatting
                output_lines = []
                
                # Get all question IDs from the first row's counts
                all_columns = []
                for row in result.data:
                    all_columns.extend(row['counts'].keys())
                question_ids = sorted(list(set(all_columns)))
                
                # Add header
                header = "\t".join([''] + question_ids)
                output_lines.append(header)
                output_lines.append("")  # Empty line after header
                
                # Add data rows
                for row in result.data:
                    counts = row['counts']
                    row_values = [row['response_value']]
                    for qid in question_ids:
                        row_values.append(str(counts.get(qid, '0')))
                    output_lines.append("\t".join(row_values))
                
                return "\n".join(output_lines)

            # For SA questions
            if question_type == 'SA':
                # Get base count
                base_count = self.supabase.rpc(
                    'get_question_count_sa',
                    {'p_question_id': question_id, 'p_response_value': None}
                ).execute()

                # Get all unique response values
                response_data = self.supabase.table('survey_responses') \
                    .select('response_value') \
                    .ilike('question_id', question_id) \
                    .is_('open_ended', 'null') \
                    .execute()

                # Process both single values and arrays
                unique_codes = set()
                for item in response_data.data:
                    if not item['response_value']:
                        continue
                    
                    value = item['response_value']
                    if value.startswith('[') and value.endswith(']'):
                        # Handle array format - strip brackets and split by comma
                        codes = value.strip('[]').replace(' ', '').split(',')
                        for code in codes:
                            if code:  # Only add non-empty codes
                                unique_codes.add(code)
                    else:
                        # Handle single value format
                        unique_codes.add(value)

                # Sort unique codes numerically if possible
                unique_codes = sorted(unique_codes, key=lambda x: int(x) if x.isdigit() else float('inf'))

                # Format output
                output = f"Base\t{base_count.data}\n\n"
                total_count = 0

                # Get count for each unique code
                for code in unique_codes:
                    count = self.supabase.rpc(
                        'get_question_count_sa',
                        {'p_question_id': question_id, 'p_response_value': code}
                    ).execute()
                    
                    if count.data > 0:
                        output += f"{code}\t{count.data}\n"
                        total_count += count.data

                output += f"\nTotal\t{total_count}"
                return output

            # For MA questions
            if question_type == 'MA':
                # Get base count with exact match
                base_count = self.supabase.rpc(
                    'get_question_count_ma',
                    {'p_question_id': question_id, 'p_response_value': None}
                ).execute()

                # Get all response values with exact match
                response_data = self.supabase.table('survey_responses') \
                    .select('response_value') \
                    .eq('question_id', question_id) \
                    .is_('open_ended', 'null') \
                    .execute()

                # Process both single values and arrays
                unique_codes = set()
                for item in response_data.data:
                    if not item['response_value']:
                        continue
                    
                    value = item['response_value']
                    if value.startswith('[') and value.endswith(']'):
                        # Handle array format - strip brackets and split by comma
                        codes = value.strip('[]').replace(' ', '').split(',')
                        unique_codes.update(code for code in codes if code)
                    else:
                        # Handle single value format
                        unique_codes.add(value)

                # Sort unique codes numerically if possible
                unique_codes = sorted(unique_codes, key=lambda x: int(x) if x.isdigit() else float('inf'))

                # Format output
                output = f"Base\t{base_count.data}\n\n"
                total_mentions = 0

                # Get count for each unique code
                for code in unique_codes:
                    count = self.supabase.rpc(
                        'get_question_count_ma',
                        {'p_question_id': question_id, 'p_response_value': code}
                    ).execute()
                    
                    if count.data > 0:
                        output += f"{code}\t{count.data}\n"
                        total_mentions += count.data

                output += f"\nTotal \t{total_mentions}"
                return output

            return "Unsupported question type"

        except Exception as e:
            print(f"Error fetching counts: {e}")
            return f"Error fetching counts: {str(e)}"

    def process_query(self, user_input):
        validation_agent = ValidationAgent()
        question_id = validation_agent.extract_question_id(user_input)
        
        if not question_id:
            return "Please specify a valid question ID (e.g., Q1, S5S6_loop[1])"

        # Use validation agent to check if question exists
        existence_check = self.supabase.rpc(
            'check_question_exists',
            {'p_question_id': question_id}
        ).execute()
        
        if existence_check.data:
            does_exist = existence_check.data.get('exists_flag')
            similar_questions = existence_check.data.get('similar_questions', [])
            
            if not does_exist:
                if similar_questions:
                    suggestion_msg = (
                        f"Question {question_id} not found. Did you mean one of these?\n" + 
                        "\n".join(f"- {q}" for q in sorted(similar_questions))
                    )
                    return suggestion_msg
                return f"Question {question_id} not found in database"

        # If question exists, proceed with getting counts
        if 'count' in user_input.lower():
            return self.get_counts(question_id)

        return "Please specify what you want to know about the question (e.g., 'count for Q1')"

# Initialize agents at the module level
validation_agent = ValidationAgent()
analytic_agent = BasicAnalyticAgent()

@app.get("/")
async def root():
    return {"status": "ok", "message": "API is running"}

@app.post("/query")
async def process_query(request: QueryRequest):
    try:
        print(f"Received query: {request.query}")
        if not validation_agent:
            raise HTTPException(status_code=500, detail="Validation agent not initialized")
        response = validation_agent.process_query(request.query)
        print(f"Generated response: {response}")
        return QueryResponse(response=response)
    except Exception as e:
        print(f"Error processing query: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail=str(e)
        )

@app.post("/validate", response_model=ValidationResponse)
async def validate_question(question_id: str):
    try:
        is_valid, message = validation_agent.validate_question(question_id)
        similar_questions = validation_agent.find_similar_questions(question_id) if not is_valid else None
        return ValidationResponse(
            is_valid=is_valid,
            message=message,
            similar_questions=similar_questions
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/counts/{question_id}")
async def get_counts(question_id: str):
    try:
        counts = analytic_agent.get_counts(question_id)
        return {"counts": counts}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.options("/query")
async def options_query():
    return JSONResponse(
        content={},
        headers={
            "Allow": "POST",
            "Access-Control-Allow-Methods": "POST",
            "Access-Control-Allow-Headers": "*"
        }
    )