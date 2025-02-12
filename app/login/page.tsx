"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import Cookies from "js-cookie"

export default function AdminLogin() {
  const [admin, setAdmin] = useState("")
  const [password, setPassword] = useState("")
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Get environment variables
    const validAdmin = process.env.NEXT_PUBLIC_ADMIN || ""
    const validPassword = process.env.NEXT_PUBLIC_PASSWORD || ""

    // Case insensitive comparison
    if (admin.toLowerCase() === validAdmin.toLowerCase() && 
        password.toLowerCase() === validPassword.toLowerCase()) {
      // Set authentication cookie
      Cookies.set("admin_authenticated", "true", { expires: 1 }) // Expires in 1 day
      router.push("/dashboard")
    } else {
      alert("Invalid credentials")
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-4">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">Sign In</h1>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="admin">Admin Login</Label>
            <Input 
              id="admin"
              placeholder="admin" 
              value={admin}
              onChange={(e) => setAdmin(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input 
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full">
            Sign in
          </Button>
        </form>
      </div>
    </div>
  )
} 