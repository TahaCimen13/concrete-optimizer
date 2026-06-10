import { redirect } from "next/navigation";
import { auth } from "@/auth";
import Navbar from "@/components/Navbar";
import DataClient from "./DataClient";

export default async function DataPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/data");

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 p-6">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-[var(--primary)]">Dataset</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Upload an industry mix dataset (.csv / .xls / .xlsx) to retrain the strength
            model on your own data. The UCI reference dataset is the baseline.
          </p>
        </header>
        <DataClient />
      </main>
    </div>
  );
}
