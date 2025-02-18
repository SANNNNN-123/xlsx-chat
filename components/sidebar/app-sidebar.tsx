import type * as React from "react"
import { FileSpreadsheet } from "lucide-react"
import { SearchForm } from "@/components/sidebar/search-form"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"

// This is sample data.
const data = {
  navMain: [
    {
      title: "Menu",
      url: "#",
      items: [
        {
          title: "Home",
          url: "#",
        },
        {
          title: "Tree View",
          url: "#",
        },
        {
          title: "DM Query Syntax",
          url: "#",
        },
        {
          title: "Visualization",
          url: "#",
        },
      ],
    },
    {
      title: "Etc",
      url: "#",
      items: [
        {
          title: "Features Request",
          url: "#",
        },
        {
          title: "Options",
          url: "#",
          isActive: true,
        }
      ],
    },
  ],
}

export function AppSidebar() {
  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-green-600 text-white">
                <FileSpreadsheet className="size-4" />
              </div>
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="font-semibold">XLSX-Chat</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        
        <SearchForm />
      </SidebarHeader>
      
      <SidebarContent>
        {/* We create a SidebarGroup for each parent. */}
        {data.navMain.map((item) => (
          <SidebarGroup key={item.title}>
            <SidebarGroupLabel>{item.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {item.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={item.isActive}>
                      <a href={item.url}>{item.title}</a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarRail />
      <div className="mt-auto p-4 text-center text-sm text-muted-foreground">
        Made by <a href="https://zuhairsan.vercel.app/" target="_blank" rel="noopener noreferrer" className="font-bold hover:underline">Zuhair Aziz</a>
      </div>
    </Sidebar>
  )
}

