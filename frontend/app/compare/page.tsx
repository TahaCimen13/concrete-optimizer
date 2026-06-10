import { redirect } from "next/navigation";
import { auth } from "@/auth";
import Navbar from "@/components/Navbar";
import CompareClient from "./CompareClient";

export default async function ComparePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/compare");

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 p-6">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-[var(--primary)]">
            Compare Scenarios
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Select two or more saved scenarios to compare their weights, constraints and
            recommended mixes side by side.
          </p>
        </header>
        <CompareClient />
      </main>
    </div>
  );
}
