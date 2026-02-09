import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { archetypes } from "@/lib/quiz";
import { generateAdvice } from "@/lib/advice";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const sessionId = body?.session_id;

    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json({ error: "Missing session_id." }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") {
      return NextResponse.json({ error: "Payment not completed." }, { status: 403 });
    }

    const attempt = await prisma.attempt.findFirst({
      where: { stripeSessionId: session.id }
    });

    if (!attempt) {
      return NextResponse.json({ error: "Attempt not found." }, { status: 404 });
    }

    if (attempt.adviceText) {
      return NextResponse.json({ advice: attempt.adviceText });
    }

    const archetype = archetypes.find((item) => item.name === attempt.archetype);
    if (!archetype) {
      return NextResponse.json({ error: "Archetype not found." }, { status: 500 });
    }

    const traits = attempt.traits as Record<string, number>;

    const adviceText = await generateAdvice({
      archetype,
      traits
    });

    const updated = await prisma.attempt.update({
      where: { id: attempt.id },
      data: { adviceText, paid: true }
    });

    return NextResponse.json({ advice: updated.adviceText });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Unable to generate advice." }, { status: 500 });
  }
}
