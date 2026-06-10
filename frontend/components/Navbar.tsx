"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useTheme } from "@/components/ThemeProvider";

const NAV = [
  { href: "/optimizer", label: "Optimizer" },
  { href: "/data", label: "Dataset" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/compare", label: "Compare" },
];

export default function Navbar() {
  const { theme, toggle } = useTheme();
  const { data: session, status } = useSession();
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-[var(--border)] bg-[var(--nav)] px-5 text-white shadow-md">
      <div className="flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent)] text-base">
            🏗️
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-sm font-bold tracking-wide">ConcreteDSS</span>
            <span className="text-[11px] text-sky-200">
              Sustainable Mix Decision Support
            </span>
          </span>
        </Link>
        <div className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                pathname.startsWith(item.href)
                  ? "bg-white/15 text-white"
                  : "text-sky-100 hover:bg-white/10"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          aria-label="Toggle theme"
          className="flex h-8 w-8 items-center justify-center rounded-md bg-white/10 text-sm hover:bg-white/20"
        >
          {theme === "dark" ? "☀️" : "🌙"}
        </button>

        {status === "authenticated" ? (
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-sky-100 sm:inline">
              {session.user?.name || session.user?.email}
            </span>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="rounded-md bg-white/10 px-3 py-1.5 text-sm font-medium hover:bg-white/20"
            >
              Sign out
            </button>
          </div>
        ) : status === "loading" ? (
          <span className="text-xs text-sky-200">…</span>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-md px-3 py-1.5 text-sm font-medium text-sky-100 hover:bg-white/10"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-white hover:brightness-110"
            >
              Sign up
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
