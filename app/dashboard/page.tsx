import { AppSidebar } from "@/components/sidebar/app-sidebar"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import ChatInterface from "@/components/chat/chat-interface"

export default function Page() {
  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col w-full">
          {/* Header Section */}
          <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b px-4 bg-white w-full">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="h-4" />
            </div>
            <Button variant="outline">Login</Button>
          </header>

          {/* Main Chat Section */}
          <main className="flex-1 overflow-y-auto w-full">
            <ChatInterface />
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}

