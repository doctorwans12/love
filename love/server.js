"use strict";

require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const Stripe = require("stripe");

const app = express();

/* --------------------
   Middleware
-------------------- */
app.use(cors());
app.use(express.json({ limit: "1mb" }));

/* --------------------
   ENV (DOAR CE AI)
-------------------- */
const PORT = Number(process.env.PORT || 3000);
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID;

if (!STRIPE_SECRET_KEY) {
  console.error("❌ Missing STRIPE_SECRET_KEY in .env");
  process.exit(1);
}
if (!STRIPE_PRICE_ID) {
  console.error("❌ Missing STRIPE_PRICE_ID in .env");
  process.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET_KEY);

/* --------------------
   In-memory store
   session_id -> result
-------------------- */
const sessionStore = new Map();

/* --------------------
   Helpers
-------------------- */
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function scaleToDelta(v) {
  const num = Number(v);
  if (!Number.isFinite(num)) return 0;
  return (num - 3) * 10; // 1..5 => -20..+20
}

function scoreAttempt(answers) {
  const traits = {
    confidence: 50,
    clarity: 50,
    playfulness: 50,
    availability: 50,
    consistency: 50,
    anxiety: 50
  };

  const add = (k, v) => traits[k] = clamp(traits[k] + v, 0, 100);
  const A = answers;

  add("confidence", scaleToDelta(A[0]?.value));
  add("anxiety", -scaleToDelta(A[0]?.value));

  if (A[1]?.value === "b") {
    add("confidence", 8); add("clarity", 8); add("playfulness", 12);
  }
  if (A[1]?.value === "d") {
    add("confidence", -12); add("anxiety", 14);
  }

  add("playfulness", scaleToDelta(A[4]?.value));
  add("confidence", scaleToDelta(A[4]?.value) * 0.6);

  add("anxiety", scaleToDelta(A[6]?.value));
  add("confidence", -scaleToDelta(A[6]?.value) * 0.5);

  add("consistency", scaleToDelta(A[10]?.value));
  add("clarity", scaleToDelta(A[14]?.value));

  let archetype = "Friendly but Vague";
  let description = "You’re warm and likable, but your messages can be unclear.";

  if (traits.anxiety >= 70 && traits.clarity <= 45) {
    archetype = "Overthinker Texter";
    description = "You overanalyze messages and stress after sending them.";
  } else if (traits.confidence >= 70 && traits.playfulness >= 65) {
    archetype = "Confident Flirter";
    description = "You’re confident, playful, and comfortable making moves.";
  } else if (traits.consistency <= 40) {
    archetype = "Avoidant Checker";
    description = "You disappear and reappear, which breaks connection.";
  } else if (traits.playfulness <= 40) {
    archetype = "Dry Responder";
    description = "Your replies feel short or emotionless.";
  }

  return { traits, archetype, description };
}

/* --------------------
   Routes
-------------------- */

// Serve index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Health check
app.get("/health", (req, res) => {
  res.send("ok");
});

// Create Stripe checkout
app.post("/create-checkout-session", async (req, res) => {
  try {
    const answers = req.body?.answers;

    if (!Array.isArray(answers) || answers.length !== 15) {
      return res.status(400).json({ error: "Invalid answers" });
    }

    const result = scoreAttempt(answers);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        { price: STRIPE_PRICE_ID, quantity: 1 }
      ],
      success_url: `http://localhost:${PORT}/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `http://localhost:${PORT}/?canceled=1`
    });

    sessionStore.set(session.id, result);

    res.json({ url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Stripe error" });
  }
});

// Verify payment
app.get("/verify-session", async (req, res) => {
  try {
    const sessionId = req.query.session_id;
    if (!sessionId) {
      return res.status(400).json({ paid: false });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return res.json({ paid: false });
    }

    const result = sessionStore.get(sessionId);
    if (!result) {
      return res.json({ paid: true, traits: {}, archetype: "", description: "" });
    }

    res.json({ paid: true, ...result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ paid: false });
  }
});

/* --------------------
   Start server
-------------------- */
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
