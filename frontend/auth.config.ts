import type { NextAuthConfig } from "next-auth";

// Edge-safe config (NO database/bcrypt imports) — shared by middleware and the
// full server-side auth. Route protection lives in the `authorized` callback.
const PROTECTED_PREFIXES = ["/dashboard", "/compare", "/data"];

export const authConfig = {
  pages: { signIn: "/login" },
  trustHost: true,
  secret: process.env.NEXTAUTH_SECRET,
  providers: [], // real providers are added in auth.ts (server runtime)
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isProtected = PROTECTED_PREFIXES.some((p) =>
        nextUrl.pathname.startsWith(p),
      );
      if (isProtected && !isLoggedIn) return false; // → redirect to signIn
      return true;
    },
  },
} satisfies NextAuthConfig;
