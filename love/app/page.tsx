import { PrimaryLink } from "@/components/Button";

export default function HomePage() {
  return (
    <section className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-16">
      <div className="flex flex-1 flex-col items-start justify-center gap-10">
        <div className="flex flex-col gap-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            Dating communication test
          </p>
          <h1 className="text-4xl font-semibold text-ink md:text-5xl">
            How Do You Talk to the Person You Like?
          </h1>
          <p className="max-w-xl text-base text-slate-600 md:text-lg">
            People are becoming more and more non-social. This quick personality test helps you
            understand your communication style in dating contexts and gives you practical advice
            to become more confident, clear, and sociable.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <PrimaryLink href="/test" label="Start the test" />
          <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs text-slate-500">
            12–18 questions · 3–4 minutes
          </div>
        </div>
      </div>
      <div className="mt-12 grid gap-6 text-sm text-slate-600 md:grid-cols-3">
        {[
          "Discover your archetype and communication strengths.",
          "See your trait scores for confidence, clarity, playfulness, and more.",
          "Get tailored advice and message scripts you can send today."
        ].map((item) => (
          <div key={item} className="rounded-2xl bg-white p-6 shadow-soft">
            {item}
          </div>
        ))}
      </div>
    </section>
  );
}
