// Next.js 16 renamed `middleware` → `proxy` (runs on the Node.js runtime).
// NextAuth's `auth` wrapper gates routes via the `authorized` callback defined
// in auth.config.ts. Protected pages also re-check `auth()` server-side as
// defense in depth.
export { auth as proxy } from "@/auth";

export const config = {
  matcher: ["/dashboard/:path*", "/compare/:path*", "/data/:path*"],
};
