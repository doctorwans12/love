import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { archetypes } from "@/lib/quiz";
import { PrimaryLink } from "@/components/Button";

type ResultsPageProps = {
  searchParams: { session_id?: string };
};

export default async function ResultsPage({ searchParams }: ResultsPageProps) {
  const sessionId = searchParams.session_id;

  if (!sessionId) {
    return (
      <section className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 px-6 py-12 text-center">
        <h1 className="text-3xl font-semibold">Results locked</h1>
        <p className="text-slate-600">
          You need a valid payment session to view your results.
        </p>
        <PrimaryLink href="/test" label="Go back to the test" />
      </section>
    );
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const paid = session.payment_status === "paid";

  if (!paid) {
    return (
      <section className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 px-6 py-12 text-center">
        <h1 className="text-3xl font-semibold">Payment incomplete</h1>
        <p className="text-slate-600">
          Your payment has not been completed, so we cannot show your results yet.
        </p>
        <PrimaryLink href="/test" label="Return to the test" />
      </section>
    );
  }

  const attempt = await prisma.attempt.findFirst({
    where: { stripeSessionId: session.id }
  });

  if (!attempt) {
    return (
      <section className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 px-6 py-12 text-center">
        <h1 className="text-3xl font-semibold">We couldn't find your attempt</h1>
        <p className="text-slate-600">Please reach out for support if this keeps happening.</p>
        <PrimaryLink href="/" label="Back to home" />
      </section>
    );
  }

  if (!attempt.paid) {
    await prisma.attempt.update({
      where: { id: attempt.id },
      data: { paid: true }
    });
  }

  const archetype = archetypes.find((item) => item.name === attempt.archetype);

  const traitMap = attempt.traits as Record<string, number>;

  return (
    <section className="mx-auto flex min-h-screen max-w-4xl flex-col gap-10 px-6 py-12">
      <header className="rounded-3xl bg-white p-10 shadow-soft">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Your archetype</p>
        <h1 className="mt-4 text-3xl font-semibold text-ink">{attempt.archetype}</h1>
        <p className="mt-3 text-slate-600">{archetype?.description}</p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-3xl bg-white p-8 shadow-soft">
          <h2 className="text-lg font-semibold text-ink">Trait scores</h2>
          <div className="mt-6 space-y-4">
            {Object.entries(traitMap).map(([key, value]) => (
              <div key={key}>
                <div className="flex items-center justify-between text-sm text-slate-600">
                  <span className="capitalize">{key.replace(/([A-Z])/g, " $1")}</span>
                  <span>{value}</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-slate-200">
                  <div className="h-2 rounded-full bg-accent" style={{ width: `${value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl bg-white p-8 shadow-soft">
          <h2 className="text-lg font-semibold text-ink">What this means</h2>
          <p className="mt-4 text-sm text-slate-600">
            {archetype?.description}
          </p>
          <div className="mt-6 space-y-4 text-sm text-slate-600">
            <div>
              <h3 className="font-semibold text-ink">Strengths</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {archetype?.strengths.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-ink">Risks</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {archetype?.risks.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-ink">What to improve</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {archetype?.improvements.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-center">
        <Link
          href={`/advice?session_id=${session.id}`}
          className="inline-flex items-center justify-center rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-dark"
        >
          Continue
        </Link>
      </div>
    </section>
  );
}
