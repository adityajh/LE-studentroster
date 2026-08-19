import { auth } from "@/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
  const { nextUrl, auth: session } = req
  const isLoggedIn = !!session

  const isAuthRoute = nextUrl.pathname.startsWith("/login")
  const isNextAuthRoute = nextUrl.pathname.startsWith("/api/auth")
  const isPublicApiRoute = nextUrl.pathname.startsWith("/api/v1")
  // Student self-onboarding — token in URL is the auth; no session required.
  // Token validation (SHA-256 hash + 14-day expiry) happens in the route handler.
  const isOnboardPage = nextUrl.pathname.startsWith("/onboard")
  const isOnboardApi = nextUrl.pathname.startsWith("/api/onboard")
  const isApiRoute = nextUrl.pathname.startsWith("/api")

  // NextAuth routes (signin, callback, etc.) — always allow through
  if (isNextAuthRoute) return NextResponse.next()

  // Public external API routes use API key auth — skip session check
  if (isPublicApiRoute) return NextResponse.next()

  // Public student self-onboarding routes — token-authenticated by the handlers
  if (isOnboardPage || isOnboardApi) return NextResponse.next()

  // Internal API routes need session
  if (isApiRoute) {
    if (!isLoggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.next()
  }

  // Auth routes: redirect to dashboard if already logged in
  if (isAuthRoute) {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL("/dashboard", nextUrl))
    }
    return NextResponse.next()
  }

  // Protected routes: redirect to login if not logged in
  if (!isLoggedIn) {
    const loginUrl = new URL("/login", nextUrl)
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public).*)"],
}
