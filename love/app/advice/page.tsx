import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { archetypes } from "@/lib/quiz";
import { generateAdvice } from "@/lib/advice";
import { PrimaryLink } from "@/components/Button";

type AdvicePageProps = {
  searchParams: { session_id?: string };
};

export default async function AdvicePage({ searchParams }: AdvicePageProps) {
  const sessionId = searchParams.session_id;

  if (!sessionId) {
    return (
      <section className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 px-6 py-12 text-center">
        <h1 className="text-3xl font-semibold">Advice locked</h1>
        <p className="text-slate-600">You need a paid session to access the advice page.</p>
        <PrimaryLink href="/test" label="Go back to the test" />
      </section>
    );
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.payment_status !== "paid") {
    return (
      <section className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 px-6 py-12 text-center">
        <h1 className="text-3xl font-semibold">Payment incomplete</h1>
        <p className="text-slate-600">Complete payment to access your personalized advice.</p>
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

  let adviceText = attempt.adviceText;
  if (!adviceText) {
    const archetype = archetypes.find((item) => item.name === attempt.archetype);
    if (!archetype) {
      throw new Error("Archetype not found for advice generation.");
    }

    const traits = attempt.traits as Record<string, number>;

    adviceText = await generateAdvice({
      archetype,
      traits
    });

    await prisma.attempt.update({
      where: { id: attempt.id },
      data: { adviceText, paid: true }
    });
  }

  return (
    <section className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-12">
      <header className="rounded-3xl bg-white p-8 shadow-soft">
        <h1 className="text-3xl font-semibold text-ink">Your practical advice</h1>
        <p className="mt-2 text-slate-600">
          Based on your answers and archetype, here are the most useful next steps.
        </p>
      </header>

      <div className="rounded-3xl bg-white p-8 shadow-soft">
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
          {adviceText}
        </div>
      </div>

      <div className="flex justify-center">
        <PrimaryLink href="/" label="Back to home" />
      </div>
    </section>
  );
}
