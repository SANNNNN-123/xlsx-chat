import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  // Get the pathname
  const path = request.nextUrl.pathname

  // Define public paths that don't require authentication
  const isPublicPath = path === "/" || path === "/login"

  // Get stored auth status
  const isAuthenticated = request.cookies.has("admin_authenticated")

  if (!isAuthenticated && !isPublicPath) {
    // Redirect to login if trying to access protected route while not authenticated
    return NextResponse.redirect(new URL("/", request.url))
  }

  if (isAuthenticated && isPublicPath) {
    // Redirect to dashboard if trying to access login while authenticated
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  return NextResponse.next()
}

// Add your protected routes
export const config = {
  matcher: ["/", "/dashboard/:path*", "/login"]
} 