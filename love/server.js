import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Stripe from "stripe";
import OpenAI from "openai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static("."));

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripePriceId = process.env.STRIPE_PRICE_ID;
const openaiApiKey = process.env.OPENAI_API_KEY;

if (!stripeSecretKey) {
  throw new Error("Missing STRIPE_SECRET_KEY in .env");
}

if (!stripePriceId) {
  throw new Error("Missing STRIPE_PRICE_ID in .env");
}

const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-06-20" });
const openaiClient = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;

const attempts = new Map();

const archetypes = [
  {
    name: "Overthinker Texter",
    description: "You care a lot and want things to go well, but you can overanalyze messages."
  },
  {
    name: "Confident Flirter",
    description: "You lead with clarity and playful energy that keeps conversations flowing."
  },
  {
    name: "Friendly but Vague",
    description: "You are warm and friendly, but your intentions can be hard to read."
  },
  {
    name: "Dry Responder",
    description: "You keep replies short and calm, which can feel distant to others."
  },
  {
    name: "Warm Storyteller",
    description: "You connect through details and emotional openness, making people feel safe."
  }
];

const fallbackAdvice = `Practical next steps

- Lead with one clear opener instead of waiting for a perfect moment.
- Use one specific compliment rather than a vague "you seem cool."
- Follow up once after a good exchange to build momentum.
- Ask one curious, light question to keep the conversation moving.
- Match their pace, not their silence—consistency builds trust.
- Keep flirting playful but pair it with warmth.
- If anxiety spikes, pause, breathe, and send a short reply.
- Say what you want clearly and kindly.
- Move from texting to real life with a simple invite.

Two message scripts

1) "Hey! You mentioned you love ___ — I just tried it and thought of you. Want to swap recommendations this week?"
2) "I like talking with you. Want to grab a quick coffee sometime and keep the convo going?"`;

function calculateTraits(answers) {
  const traits = {
    confidence: 50,
    clarity: 50,
    playfulness: 50,
    emotional: 50,
    consistency: 50,
    anxiety: 50
  };

  const adjust = (trait, delta) => {
    traits[trait] = Math.max(0, Math.min(100, traits[trait] + delta));
  };

  Object.values(answers).forEach((value) => {
    if (value === 0) adjust("confidence", 6);
    if (value === 1) adjust("anxiety", 8);
    if (value === 2) adjust("consistency", -4);
    if (value === 3) adjust("playfulness", 6);
    if (value === 4) adjust("emotional", 5);
  });

  return traits;
}

function determineArchetype(traits) {
  if (traits.anxiety > 70 && traits.clarity < 50) return archetypes[0];
  if (traits.confidence > 70 && traits.playfulness > 60) return archetypes[1];
  if (traits.consistency < 45 && traits.confidence < 55) return archetypes[3];
  if (traits.emotional > 70) return archetypes[4];
  return archetypes[2];
}

app.post("/create-checkout-session", async (req, res) => {
  try {
    const answers = req.body?.answers;
    const isObject = answers && typeof answers === "object" && !Array.isArray(answers);
    const isArray = Array.isArray(answers);

    if (!isObject && !isArray) {
      return res.status(400).json({ error: "Missing answers." });
    }

    const normalizedAnswers = isArray
      ? answers.reduce((acc, value, index) => {
          acc[`q${index + 1}`] = value;
          return acc;
        }, {})
      : answers;

    const traits = calculateTraits(normalizedAnswers);
    const archetype = determineArchetype(traits);

    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{ price: stripePriceId, quantity: 1 }],
      success_url: `${baseUrl}/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/?canceled=1`,
      currency: "eur"
    });

    attempts.set(session.id, { traits, archetype });

    return res.json({ url: session.url });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Unable to create checkout session." });
  }
});

app.get("/verify-session", async (req, res) => {
  try {
    const sessionId = req.query.session_id;
    if (!sessionId) {
      return res.status(400).json({ error: "Missing session_id." });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") {
      return res.json({ paid: false });
    }

    const attempt = attempts.get(sessionId);
    if (!attempt) {
      return res.status(404).json({ paid: false, error: "Attempt not found." });
    }

    return res.json({
      paid: true,
      archetype: { name: attempt.archetype.name },
      description: attempt.archetype.description,
      traits: attempt.traits
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ paid: false, error: "Unable to verify session." });
  }
});

app.post("/generate-advice", async (req, res) => {
  try {
    const { archetype, traits } = req.body || {};

    if (!archetype || !traits) {
      return res.status(400).json({ error: "Missing archetype or traits." });
    }

    if (!openaiClient) {
      return res.json({ advice: fallbackAdvice });
    }

    const prompt = `You are a coach for dating communication. Provide 8-12 practical bullet points and 2 message scripts.

Archetype: ${archetype.name}
Traits: ${JSON.stringify(traits)}

Tone: practical, encouraging, not cringe. Format with clear section titles.`;

    const completion = await openaiClient.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7
    });

    const advice = completion.choices[0]?.message?.content?.trim() || fallbackAdvice;
    return res.json({ advice });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Unable to generate advice." });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`Server running on http://localhost:${process.env.PORT || 3000}`);
});
