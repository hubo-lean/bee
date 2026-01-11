import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const publicRoutes = ["/login", "/register", "/"];
const authRoutes = ["/login", "/register"];

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const path = req.nextUrl.pathname;

  const isPublicRoute = publicRoutes.includes(path);
  const isAuthRoute = authRoutes.includes(path);
  const isApiAuthRoute = path.startsWith("/api/auth");

  // Allow auth API routes
  if (isApiAuthRoute) {
    return NextResponse.next();
  }

  // Redirect logged-in users away from auth pages
  if (isAuthRoute && isLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Redirect unauthenticated users to login for protected routes
  if (!isLoggedIn && !isPublicRoute) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
