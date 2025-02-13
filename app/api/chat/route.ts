import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();
    const latestMessage = messages[messages.length - 1].content;
    
    // Use environment variable for API URL
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
    
    const response = await fetch(`${apiUrl}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: latestMessage }),
    });

    const data = await response.json();
    console.log('FastAPI Response:', data);

    if (!response.ok) {
      throw new Error(data.detail || 'Failed to fetch from FastAPI');
    }

    if (!data.response) {
      throw new Error('Invalid response format from FastAPI');
    }

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
          model: 'gpt-4',
          choices: [{
            delta: { content: data.response },
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

