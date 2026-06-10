"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Registration failed.");
        setLoading(false);
        return;
      }
      // Auto sign-in after successful registration.
      const signInRes = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      setLoading(false);
      if (signInRes?.error) {
        router.push("/login");
      } else {
        router.push("/optimizer");
        router.refresh();
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-md">
          <h1 className="mb-1 text-xl font-bold text-[var(--primary)]">
            Create your account
          </h1>
          <p className="mb-6 text-sm text-[var(--text-muted)]">
            Save and compare optimization scenarios.
          </p>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <Field label="Name (optional)" type="text" value={name} onChange={setName} />
            <Field
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              required
              autoComplete="email"
            />
            <Field
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              required
              autoComplete="new-password"
              hint="At least 6 characters."
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="mt-1 rounded-md bg-gradient-to-br from-[var(--primary-light)] to-[#1d4e89] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-60"
            >
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>
          <p className="mt-5 text-center text-sm text-[var(--text-muted)]">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-[var(--primary-light)]">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  required,
  autoComplete,
  hint,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  autoComplete?: string;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-[var(--text)]">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
      />
      {hint && <span className="text-xs text-[var(--text-muted)]">{hint}</span>}
    </label>
  );
}
