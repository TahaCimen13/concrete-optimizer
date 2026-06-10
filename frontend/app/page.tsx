import Link from "next/link";
import Navbar from "@/components/Navbar";

const FEATURES = [
  {
    icon: "🌿",
    title: "Sustainability First",
    text: "Minimize embodied CO₂ by favouring slag and fly ash over Portland cement clinker.",
  },
  {
    icon: "📊",
    title: "3D Pareto Exploration",
    text: "Rotate an interactive trade-off surface across CO₂, cost and strength — non-dominated mixes highlighted.",
  },
  {
    icon: "🎚️",
    title: "Weighted-Sum Optimization",
    text: "Tune objective priorities live; the recommended mix and insights update instantly.",
  },
  {
    icon: "💾",
    title: "Save & Compare",
    text: "Persist scenarios to your account and compare them side by side, then export a PDF report.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex flex-1 flex-col">
        <section className="flex flex-col items-center gap-6 px-6 py-20 text-center">
          <span className="rounded-full border border-sky-300 bg-[var(--primary-pale)] px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--primary-light)]">
            Decision Support System · Prototype
          </span>
          <h1 className="max-w-3xl text-4xl font-extrabold leading-tight text-[var(--primary)] sm:text-5xl">
            Optimize concrete mixes for{" "}
            <span className="text-[var(--accent)]">CO₂, cost & strength</span> — all at
            once.
          </h1>
          <p className="max-w-2xl text-base text-[var(--text-muted)]">
            ConcreteDSS turns a multi-objective trade-off into an interactive 3D Pareto
            front. Set your engineering priorities, see the recommended sustainable mix,
            and save scenarios for comparison.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/optimizer"
              className="rounded-lg bg-gradient-to-br from-[var(--primary-light)] to-[#1d4e89] px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:brightness-110"
            >
              Launch Optimizer →
            </Link>
            <Link
              href="/register"
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-6 py-3 text-sm font-semibold text-[var(--primary)] transition hover:bg-[var(--primary-pale)]"
            >
              Create free account
            </Link>
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-4 px-6 pb-20 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm"
            >
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--primary-pale)] text-xl">
                {f.icon}
              </div>
              <h3 className="mb-1.5 text-sm font-bold text-[var(--primary)]">{f.title}</h3>
              <p className="text-sm leading-relaxed text-[var(--text-muted)]">{f.text}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-[var(--border)] py-5 text-center text-xs text-[var(--text-muted)]">
        ConcreteDSS · Prototype v1.0 · For research and decision-support use only.
        Results require physical validation before engineering application.
      </footer>
    </div>
  );
}
