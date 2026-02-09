import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { determineArchetype, scoreAnswers } from "@/lib/quiz";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const answers = body?.answers;
    const attemptId = typeof body?.attempt_id === "string" ? body.attempt_id : null;

    if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
      return NextResponse.json({ error: "Missing answers." }, { status: 400 });
    }

    const priceId = process.env.PRICE_ID_EUR;
    if (!priceId) {
      return NextResponse.json({ error: "Missing PRICE_ID_EUR." }, { status: 500 });
    }

    const traits = scoreAnswers(answers);
    const archetype = determineArchetype(traits);

    const attempt = attemptId
      ? await prisma.attempt.upsert({
          where: { id: attemptId },
          update: { answers, traits, archetype: archetype.name },
          create: { id: attemptId, answers, traits, archetype: archetype.name }
        })
      : await prisma.attempt.create({
          data: {
            answers,
            traits,
            archetype: archetype.name
          }
        });

    const baseUrl = process.env.BASE_URL || request.headers.get("origin") || "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/results?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/test?canceled=1`,
      metadata: {
        attemptId: attempt.id
      }
    });

    await prisma.attempt.update({
      where: { id: attempt.id },
      data: { stripeSessionId: session.id }
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Unable to create checkout session." }, { status: 500 });
  }
}
