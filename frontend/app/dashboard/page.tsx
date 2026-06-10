import { redirect } from "next/navigation";
import { auth } from "@/auth";
import Navbar from "@/components/Navbar";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  // Defense in depth: proxy gates this route, but re-check server-side too.
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard");

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 p-6">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-[var(--primary)]">
            Welcome{session.user.name ? `, ${session.user.name}` : ""} 👋
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Your saved optimization scenarios.
          </p>
        </header>
        <DashboardClient />
      </main>
    </div>
  );
}
