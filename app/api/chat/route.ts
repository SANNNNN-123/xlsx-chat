import { NextRequest } from 'next/server';
import { getApiUrl } from '@/lib/utils';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Google Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();
    const latestMessage = messages[messages.length - 1].content;
    
    // Initialize the model
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-thinking-exp-01-21" });
    
    // Get response from Gemini
    const result = await model.generateContent(latestMessage);
    const responseText = await result.response.text();

    // Create a TextEncoder to properly encode the stream data
    const encoder = new TextEncoder();

    // Create a stream from the response
    const stream = new ReadableStream({
      start(controller) {
        // Send the message
        const message = JSON.stringify({
          id: 'chatcmpl-' + Date.now(),
          object: 'chat.completion.chunk',
          created: Date.now(),
          model: 'gemini-pro',  // Changed from gpt-4 to gemini-pro
          choices: [{
            delta: { content: responseText },
            index: 0,
            finish_reason: null
          }]
        });

        // Encode and send the message
        controller.enqueue(encoder.encode(`data: ${message}\n\n`));
        
        // Send the [DONE] message
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Error in chat route:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to process query'
      }),
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
}

