import { auth } from "@/auth"
import { NextResponse, type NextRequest } from "next/server"

const authHandler = auth((req) => {
  const { nextUrl, auth: session } = req
  const isLoggedIn = !!session

  const isAuthRoute = nextUrl.pathname.startsWith("/login")
  const isNextAuthRoute = nextUrl.pathname.startsWith("/api/auth")
  const isPublicApiRoute = nextUrl.pathname.startsWith("/api/v1")
  const isOnboardPage = nextUrl.pathname.startsWith("/onboard")
  const isOnboardApi = nextUrl.pathname.startsWith("/api/onboard")
  const isApiRoute = nextUrl.pathname.startsWith("/api")

  if (isNextAuthRoute) return NextResponse.next()
  if (isPublicApiRoute) return NextResponse.next()
  if (isOnboardPage || isOnboardApi) return NextResponse.next()

  if (isApiRoute) {
    if (!isLoggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.next()
  }

  if (isAuthRoute) {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL("/dashboard", nextUrl))
    }
    return NextResponse.next()
  }

  if (!isLoggedIn) {
    const loginUrl = new URL("/login", nextUrl)
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
})

export default async function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/api/debug-users")) {
    return NextResponse.next()
  }
  return (authHandler as any)(req)
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public).*)"],
}

