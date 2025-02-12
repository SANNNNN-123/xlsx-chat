-- Main table for all survey responses
CREATE TABLE survey_responses (
    respondent_id INT,
    question_id VARCHAR(50),      -- Base question ID (e.g., "Q16_loop[1]")
    sub_question VARCHAR(50) DEFAULT '',     -- Sub question part with default empty string
    outer_category VARCHAR(50) NULL,
    inner_category INT NULL,
    response_value VARCHAR(255) NULL,
    question_type VARCHAR(20),
    open_ended TEXT NULL,
    CONSTRAINT pk_survey_responses PRIMARY KEY 
        (respondent_id, question_id, sub_question)
);


-----------------COUNT FOR SA-------------------------------------------------------------------
------------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_question_count_sa(p_question_id TEXT, p_response_value TEXT)
RETURNS bigint AS $$
BEGIN
    IF p_response_value IS NULL THEN
        -- Return base count (total respondents)
        RETURN (
            SELECT COUNT(DISTINCT respondent_id)
            FROM survey_responses
            WHERE question_id ILIKE p_question_id
            AND question_type = 'SA'
        );
    ELSE
        -- Return count for specific response value, handling both single values and arrays
        RETURN (
            SELECT COUNT(*)
            FROM survey_responses
            WHERE question_id ILIKE p_question_id
            AND question_type = 'SA'
            AND (
                -- Match exact single value
                response_value = p_response_value
                OR 
                -- Match value in array format by converting array to elements
                CASE 
                    WHEN response_value LIKE '[%]' THEN
                        p_response_value = ANY(
                            string_to_array(
                                trim(both '[]' from response_value),
                                ','
                            )
                        )
                    ELSE false
                END
            )
        );
    END IF;
END;
$$ LANGUAGE plpgsql;

-----------------COUNT FOR MA-------------------------------------------------------------------
------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_question_count_ma(p_question_id TEXT, p_response_value TEXT)
RETURNS bigint AS $$
BEGIN
    IF p_response_value IS NULL THEN
        -- For Base count: count distinct respondents
        RETURN (
            SELECT COUNT(DISTINCT respondent_id)
            FROM survey_responses
            WHERE question_id = p_question_id
            AND question_type = 'MA'
        );
    ELSE
        -- For specific response value: count all occurrences of this option
        RETURN (
            SELECT COUNT(*)
            FROM survey_responses
            WHERE question_id = p_question_id
            AND question_type = 'MA'
            AND (
                -- Match exact single value
                response_value = p_response_value
                OR 
                -- Match value in array format by converting array to elements
                CASE 
                    WHEN response_value LIKE '[%]' THEN
                        p_response_value = ANY(
                            string_to_array(
                                trim(both '[]' from replace(response_value, ' ', '')),
                                ','
                            )
                        )
                    ELSE false
                END
            )
        );
    END IF;
END;
$$ LANGUAGE plpgsql;

-----------------COUNT FOR GRID-------------------------------------------------------------------
------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_grid_question_counts(
    p_base_question_id TEXT,
    p_grid_numbers TEXT[]
)
RETURNS TABLE (
    response_value TEXT,
    counts JSONB
) AS $$
DECLARE
    full_question_ids TEXT[];
BEGIN
    -- Get all valid question IDs for the grid
    IF array_length(p_grid_numbers, 1) > 0 THEN
        -- If grid numbers provided, use them to construct question IDs
        SELECT ARRAY_AGG(p_base_question_id || '[' || num || ']')::TEXT[]
        FROM unnest(p_grid_numbers) num
        INTO full_question_ids;
    ELSE
        -- If no grid numbers provided, find all existing grid variations
        SELECT ARRAY_AGG(DISTINCT sr.question_id)::TEXT[]
        FROM survey_responses sr
        WHERE sr.question_id LIKE p_base_question_id || '[%]'
        AND sr.question_type = 'GRID'
        INTO full_question_ids;
    END IF;

    -- If no grid variations found and no specific numbers provided, use the base ID
    IF full_question_ids IS NULL OR array_length(full_question_ids, 1) = 0 THEN
        full_question_ids := ARRAY[p_base_question_id];
    END IF;

    -- Return base counts and response value counts
    RETURN QUERY
    WITH all_responses AS (
        SELECT DISTINCT sr.response_value::TEXT
        FROM survey_responses sr
        WHERE sr.question_id = ANY(full_question_ids)
        AND sr.response_value IS NOT NULL
        UNION ALL
        SELECT 'Base'::TEXT
    )
    SELECT 
        r.response_value::TEXT,
        jsonb_object_agg(
            q.question_id,
            CASE 
                WHEN r.response_value = 'Base' THEN
                    (SELECT COUNT(DISTINCT sr2.respondent_id)::TEXT
                     FROM survey_responses sr2
                     WHERE sr2.question_id = q.question_id)
                ELSE
                    (SELECT COUNT(*)::TEXT
                     FROM survey_responses sr2
                     WHERE sr2.question_id = q.question_id
                     AND sr2.response_value = r.response_value)
            END
        )::JSONB as counts
    FROM all_responses r
    CROSS JOIN (
        SELECT unnest(full_question_ids)::TEXT as question_id
    ) q
    GROUP BY r.response_value
    ORDER BY 
        CASE WHEN r.response_value = 'Base' THEN 0 ELSE 1 END,
        CASE 
            WHEN r.response_value ~ '^\d+$' THEN LPAD(r.response_value, 10, '0')
            ELSE r.response_value 
        END;
END;
$$ LANGUAGE plpgsql;

-----------------CHECK QUESTION EXISTS---------------------------------------------------------------
------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_question_exists(p_question_id TEXT)
RETURNS JSONB AS $$
DECLARE
    exact_match_count INT;
    similar_question_array TEXT[]; 
BEGIN
    -- Check for exact match in question_id and sub_question (case sensitive)
    SELECT COUNT(*)
    INTO exact_match_count
    FROM survey_responses
    WHERE question_id = p_question_id 
    OR sub_question = p_question_id;  -- Case sensitive match

    IF exact_match_count > 0 THEN
        -- Return JSON indicating existence
        RETURN jsonb_build_object(
            'exists_flag', TRUE,
            'similar_questions', '[]'::jsonb
        );
    ELSE
        -- If no exact match, find suggestions based on the input (case insensitive)
        SELECT ARRAY_AGG(DISTINCT question_id)
        INTO similar_question_array
        FROM survey_responses
        WHERE 
            question_id ILIKE '%' || p_question_id || '%' 
            OR sub_question ILIKE '%' || p_question_id || '%'
            OR question_id ILIKE '%' || UPPER(p_question_id) || '_loop[%]';

        -- Return JSON with suggestions
        RETURN jsonb_build_object(
            'exists_flag', FALSE,
            'similar_questions', COALESCE(to_jsonb(similar_question_array), '[]'::jsonb)
        );
    END IF;
END;
$$ LANGUAGE plpgsql;
