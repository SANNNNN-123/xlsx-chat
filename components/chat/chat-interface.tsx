"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MessageCircle, ArrowUp } from "lucide-react"
import { ChatMessages } from "@/components/chat/chat-messages"
import { Message } from "ai/react"
import { getApiUrl } from "@/lib/utils"
import { formatTableContent } from './table-formatters'

const styles = {
  userMessage: `flex justify-end mb-4`,
  userBubble: `bg-black text-white rounded-2xl py-2 px-4 max-w-[80%]`,
  assistantMessage: `flex justify-start mb-4`,
  assistantBubble: `bg-gray-100 rounded-2xl py-2 px-4 max-w-[80%]`,
  chatContainer: `w-full max-w-4xl mx-auto px-4`,
  messageContainer: `flex-1 overflow-y-auto space-y-4 px-4`,
  inputContainer: `fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-sm pb-6 pt-4 border-t`,
};

export default function ChatInterface() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    try {
      setIsLoading(true);
      setError(null);
      
      setMessages(prev => [...prev, {
        id: String(Date.now()),
        role: 'user',
        content: input
      }]);

      const response = await fetch(`${getApiUrl('')}/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ query: input }),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch from API: ${response.status}`);
      }

      const data = await response.json();

      if (!data.response) {
        throw new Error('Invalid response format from API');
      }

      // Format the response using the new formatter
      const formattedContent = formatTableContent(data.response);

      setMessages(prev => [...prev, {
        id: String(Date.now()),
        role: 'assistant',
        content: formattedContent
      }]);

      setInput('');
    } catch (err) {
      setError("Failed to send message. Please try again.");
      console.error("Chat error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const examplePrompts = [
    {
      title: "What is count and mean of",
      subtitle: "variable S0",
    },
    {
      title: "Can you check if ",
      subtitle: "Q10 exists in the database?",
    },
    {
      title: "Find me summary grid of",
      subtitle: "S5S6_loop variable",
    },
    {
      title: "Give me count for",
      subtitle: "in San Francisco?",
    },
  ];

  return (
    <div className="flex flex-col h-full w-full">
      {/* Messages Section */}
      <div className="flex-1 overflow-y-auto py-10 w-full">
        <div className={styles.chatContainer}>
          {messages.length === 0 ? (
            <div className="text-center space-y-4 pt-8">
              <p className="text-lg">
                Upload your workbook and ask questions about your data.
              </p>
              <p className="text-lg">
                It uses{" "}
                <code className="bg-muted px-1 py-0.5 rounded">Excel processing</code> and{" "}
                <code className="bg-muted px-1 py-0.5 rounded">AI analysis</code> to provide insights about your spreadsheets.
              </p>
              <p>
                Start by uploading your Excel file below and then ask any questions about your data.
              </p>
            </div>
          ) : (
            <div className={styles.messageContainer}>
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={message.role === 'user' ? styles.userMessage : styles.assistantMessage}
                >
                  {message.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mr-2">
                      <span className="animate-pulse">✨</span>
                    </div>
                  )}
                  <div className={message.role === 'user' ? styles.userBubble : styles.assistantBubble}>
                    {typeof message.content === 'string' ? message.content : message.content}
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="text-red-500 text-center p-2">
              {error}
            </div>
          )}

          {messages.length === 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              {examplePrompts.map((prompt, i) => (
                <Button
                  key={i}
                  variant="outline"
                  className="h-auto p-4 text-left"
                  onClick={() => {
                    setInput(`${prompt.title} ${prompt.subtitle}`);
                    handleSubmit(new Event('submit') as any);
                  }}
                >
                  <div>
                    <div className="font-normal">{prompt.title}</div>
                    <div className="text-muted-foreground">{prompt.subtitle}</div>
                  </div>
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Input Section */}
      <div className="bg-white py-4 w-full">
        <div className={styles.chatContainer}>
          <form onSubmit={handleSubmit} className="relative">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Send a message..."
              className="w-full px-8 py-4 text-lg bg-gray-100 rounded-3xl border-2 border-gray-300 shadow-sm focus:ring-0 focus:border-gray-400 h-16"
              disabled={isLoading}
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <Button 
                type="submit" 
                size="sm"
                variant="ghost"
                className="text-gray-400 hover:text-gray-600"
                disabled={!input.trim() || isLoading}
              >
                {isLoading ? (
                  <div className="animate-spin h-5 w-5 border-2 border-gray-400 border-t-transparent rounded-full" />
                ) : (
                  <ArrowUp className="h-5 w-5" />
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}