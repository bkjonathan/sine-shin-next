import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;

  const isLoggedIn = !!req.auth;
  const isAuthPage = pathname.startsWith("/login");
  const isApiAuthRoute = pathname.startsWith("/api/auth");
  // Cargo-item tracking pages. Carriers reach these by scanning the QR on a
  // parcel, so they cannot sign in — the unguessable code in the path is what
  // authorises the request, and the page only exposes shipment-label facts.
  const isTrackingPage = pathname.startsWith("/t/");
  const isPublic = isAuthPage || isApiAuthRoute || isTrackingPage;

  if (!isLoggedIn && !isPublic) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|icons/|sw\\.js|manifest\\.webmanifest|browserconfig\\.xml).*)",
  ],
};
