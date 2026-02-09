"use strict";

require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const Stripe = require("stripe");
const { OpenAI } = require("openai");

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const PORT = Number(process.env.PORT || 3000);
const BASE_URL = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, "");

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

if (!STRIPE_SECRET_KEY) console.warn("Missing STRIPE_SECRET_KEY");
if (!STRIPE_PRICE_ID) console.warn("Missing STRIPE_PRICE_ID");
if (!process.env.BASE_URL) console.warn("Missing BASE_URL (Railway public URL).");

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

// In-memory store: session_id -> { traits, archetype, description }
const sessionStore = new Map();

/** Shared scoring (server-side truth) */
function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function scoreAttempt(answers) {
  // Traits: 0..100
  const traits = {
    confidence: 50,
    clarity: 50,
    playfulness: 50,
    availability: 50,
    consistency: 50,
    anxiety: 50
  };

  // Expect answers as array length 15, each item either:
  // { type:'scale', value:1..5 } or { type:'choice', value: 'a'|'b'|'c'|'d' }
  // We'll map each question to trait effects.

  const A = Array.isArray(answers) ? answers : [];

  function scaleToDelta(v) {
    // v 1..5 -> -20..+20
    const num = Number(v);
    if (!Number.isFinite(num)) return 0;
    return (num - 3) * 10;
  }

  function add(t, d) {
    traits[t] = clamp(traits[t] + d, 0, 100);
  }

  // Q1 scale: starting convo confidence
  add("confidence", scaleToDelta(A[0]?.value));
  add("anxiety", -scaleToDelta(A[0]?.value));

  // Q2 choice: what do you text first?
  // a = simple hello (neutral), b = witty opener (play+clar+conf),
  // c = overlong paragraph (anx+avail but lower clarity), d = don't text (anx- confidence)
  switch (A[1]?.value) {
    case "b": add("playfulness", +12); add("clarity", +8); add("confidence", +8); break;
    case "c": add("availability", +8); add("anxiety", +10); add("clarity", -8); break;
    case "d": add("anxiety", +14); add("confidence", -12); add("consistency", -6); break;
    default: add("clarity", +2); break;
  }

  // Q3 scale: how fast you reply (healthy balance = 3)
  // too fast (1) or too slow (5) => anxiety/consistency issues
  {
    const v = Number(A[2]?.value);
    if (v === 3) { add("consistency", +10); add("anxiety", -6); }
    else if (v <= 2) { add("anxiety", +8); add("availability", +6); add("clarity", -2); }
    else if (v >= 4) { add("consistency", -6); add("clarity", -2); }
  }

  // Q4 choice: seen no reply
  // a chill, b double text polite, c triple text, d ghost back
  switch (A[3]?.value) {
    case "a": add("confidence", +10); add("anxiety", -10); add("consistency", +4); break;
    case "b": add("clarity", +8); add("consistency", +6); add("anxiety", +2); break;
    case "c": add("anxiety", +14); add("clarity", -6); add("confidence", -6); break;
    case "d": add("consistency", -12); add("availability", -8); add("anxiety", +4); break;
  }

  // Q5 scale: flirting comfort
  add("playfulness", scaleToDelta(A[4]?.value));
  add("confidence", scaleToDelta(A[4]?.value) * 0.6);

  // Q6 choice: compliment style
  // a generic, b specific, c too intense, d none
  switch (A[5]?.value) {
    case "b": add("clarity", +10); add("availability", +6); break;
    case "c": add("availability", +10); add("anxiety", +6); add("clarity", -6); break;
    case "d": add("clarity", -6); add("confidence", -4); break;
    default: add("clarity", +2); break;
  }

  // Q7 scale: overthinking after sending a text
  add("anxiety", scaleToDelta(A[6]?.value));
  add("confidence", -scaleToDelta(A[6]?.value) * 0.5);

  // Q8 choice: making plans
  // a direct plan, b hint, c wait for them, d avoid meeting
  switch (A[7]?.value) {
    case "a": add("clarity", +12); add("confidence", +10); add("consistency", +6); break;
    case "b": add("playfulness", +6); add("clarity", -2); break;
    case "c": add("consistency", -6); add("anxiety", +6); break;
    case "d": add("availability", -12); add("anxiety", +10); add("confidence", -6); break;
  }

  // Q9 scale: emotional openness
  add("availability", scaleToDelta(A[8]?.value));
  add("clarity", scaleToDelta(A[8]?.value) * 0.4);

  // Q10 choice: humor usage
  // a often, b sometimes, c rarely, d never
  switch (A[9]?.value) {
    case "a": add("playfulness", +12); add("confidence", +4); break;
    case "b": add("playfulness", +6); break;
    case "c": add("playfulness", -4); break;
    case "d": add("playfulness", -10); break;
  }

  // Q11 scale: consistency (do you disappear)
  add("consistency", scaleToDelta(A[10]?.value));
  add("anxiety", -scaleToDelta(A[10]?.value) * 0.3);

  // Q12 choice: boundaries
  // a clear, b flexible, c people-pleasing, d cold wall
  switch (A[11]?.value) {
    case "a": add("clarity", +10); add("confidence", +6); add("availability", +2); break;
    case "b": add("availability", +4); break;
    case "c": add("anxiety", +10); add("clarity", -6); break;
    case "d": add("availability", -10); add("confidence", +2); add("clarity", -2); break;
  }

  // Q13 scale: texting vs real life comfort (higher means IRL comfortable)
  add("confidence", scaleToDelta(A[12]?.value));
  add("anxiety", -scaleToDelta(A[12]?.value));

  // Q14 choice: when they flirt first
  // a match energy, b shy, c ignore, d act too intense
  switch (A[13]?.value) {
    case "a": add("confidence", +8); add("playfulness", +8); add("clarity", +4); break;
    case "b": add("anxiety", +6); add("availability", +2); break;
    case "c": add("availability", -8); add("consistency", -4); break;
    case "d": add("anxiety", +10); add("clarity", -6); add("confidence", -2); break;
  }

  // Q15 scale: clarity in what you want (higher = clearer intentions)
  add("clarity", scaleToDelta(A[14]?.value));
  add("confidence", scaleToDelta(A[14]?.value) * 0.4);

  // Archetype rules
  const t = traits;
  let archetype = "Friendly but Vague";
  let description = "You’re warm and likable, but your messages can be unclear. A little more directness will make your dating life easier.";

  if (t.anxiety >= 70 && t.clarity <= 45) {
    archetype = "Overthinker Texter";
    description = "You care a lot, but you spiral after sending messages. The goal: calmer texting + clearer intent.";
  } else if (t.confidence >= 70 && t.playfulness >= 65 && t.anxiety <= 45) {
    archetype = "Confident Flirter";
    description = "You’re bold, fun, and comfortable making moves. Keep it respectful and consistent.";
  } else if (t.consistency <= 40 && t.availability <= 45) {
    archetype = "Avoidant Checker";
    description = "You pop in and out and keep distance. Building trust means showing up more consistently.";
  } else if (t.playfulness <= 40 && t.clarity <= 50) {
    archetype = "Dry Responder";
    description = "Your replies can feel short or flat. Add warmth, questions, and small sparks of personality.";
  } else if (t.availability >= 65 && t.clarity >= 60 && t.playfulness >= 50) {
    archetype = "Warm Storyteller";
    description = "You connect through warmth and good conversation. Keep your messages focused and action-oriented.";
  }

  return { traits, archetype, description };
}

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.post("/create-checkout-session", async (req, res) => {
  try {
    if (!stripe) return res.status(500).json({ error: "Stripe not configured" });
    if (!STRIPE_PRICE_ID) return res.status(500).json({ error: "Missing STRIPE_PRICE_ID" });

    const answers = req.body?.answers;
    if (!Array.isArray(answers) || answers.length !== 15) {
      return res.status(400).json({ error: "Invalid answers. Expected array of 15 items." });
    }

    const computed = scoreAttempt(answers);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
      success_url: `${BASE_URL}/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${BASE_URL}/?canceled=1`
    });

    // store by session id
    sessionStore.set(session.id, computed);

    res.json({ url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

app.get("/verify-session", async (req, res) => {
  try {
    if (!stripe) return res.status(500).json({ paid: false, error: "Stripe not configured" });

    const session_id = String(req.query.session_id || "");
    if (!session_id) return res.status(400).json({ paid: false, error: "Missing session_id" });

    const session = await stripe.checkout.sessions.retrieve(session_id);

    const paid = session.payment_status === "paid";
    if (!paid) return res.json({ paid: false });

    const computed = sessionStore.get(session_id) || { traits: null, archetype: null, description: null };
    return res.json({ paid: true, ...computed });
  } catch (err) {
    console.error(err);
    res.status(500).json({ paid: false, error: "Failed to verify session" });
  }
});

function fallbackAdvice(archetype, traits) {
  const t = traits || {};
  return [
    `Your type: ${archetype || "Unknown"}`,
    "",
    "Practical advice:",
    "• Keep messages short and clear (1–2 sentences).",
    "• Ask one specific question instead of many at once.",
    "• Match their energy: if they reply short, you reply short (but warm).",
    "• Don’t chase “seen” — wait, then follow up once with confidence.",
    "• Flirt lightly: playful teasing + a genuine compliment.",
    "• Move to a simple plan: “Coffee this week? Tue or Thu?”",
    "• If you feel anxious, pause 10 minutes before sending.",
    "• Consistency beats intensity: show up regularly, not dramatically.",
    "",
    "Message scripts:",
    "1) “Hey 🙂 quick one: how did your day go? Also—what’s something that made you laugh recently?”",
    "2) “You seem fun. Want to grab coffee this week? Tue or Thu works for me.”"
  ].join("\n");
}

app.post("/generate-advice", async (req, res) => {
  try {
    const { archetype, traits } = req.body || {};
    if (typeof archetype !== "string" || !traits || typeof traits !== "object") {
      return res.status(400).json({ error: "Invalid payload" });
    }

    if (!openai) {
      return res.json({ adviceText: fallbackAdvice(archetype, traits) });
    }

    const prompt = `
You are a practical dating coach. Generate personalized advice for this user.

Archetype: ${archetype}
Traits (0-100):
- Confidence: ${traits.confidence}
- Clarity: ${traits.clarity}
- Playfulness: ${traits.playfulness}
- Emotional Availability: ${traits.availability}
- Consistency: ${traits.consistency}
- Anxiety: ${traits.anxiety}

Output format:
- 8 to 12 bullet points (use "• ")
- Then a blank line
- Then "Message scripts:" line
- Then 2 numbered message scripts they can send (1) and (2)
Tone: encouraging, practical, not cringe.
Keep it concise and actionable.
    `.trim();

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8
    });

    const adviceText = completion.choices?.[0]?.message?.content?.trim() || fallbackAdvice(archetype, traits);
    res.json({ adviceText });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate advice" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("listening", PORT));

});

