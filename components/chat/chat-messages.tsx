"use client"

import { Message } from "ai"
import { cn } from "@/lib/utils"

interface ChatMessagesProps {
  messages: Message[]
}

export function ChatMessages({ messages }: ChatMessagesProps) {
  if (!messages.length) {
    return null
  }

  return (
    <div className="relative mx-auto max-w-3xl px-4">
      {messages.map((message, index) => (
        <div
          key={index}
          className={cn(
            "mb-4 flex items-start gap-4 px-4 py-2 rounded-lg",
            message.role === "assistant" 
              ? "mr-auto bg-muted" 
              : "ml-auto flex-row-reverse bg-blue-500 text-white"
          )}
        >
          <div className={cn(
            "flex size-8 shrink-0 select-none items-center justify-center rounded-md border shadow",
            message.role === "assistant" 
              ? "bg-background" 
              : "bg-blue-600 border-blue-400"
          )}>
            {message.role === "assistant" ? "🤖" : "👤"}
          </div>
          <div className="flex-1 space-y-2 overflow-hidden max-w-[80%]">
            <div className="prose break-words dark:prose-invert prose-p:leading-relaxed prose-pre:p-0">
              <p className="whitespace-pre-wrap">{message.content}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
} 