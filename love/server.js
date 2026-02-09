"use strict";

require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const Stripe = require("stripe");

const app = express();
app.set("trust proxy", 1);

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
const isStripeConfigured = Boolean(STRIPE_SECRET_KEY && STRIPE_PRICE_ID);

if (!STRIPE_SECRET_KEY) {
  console.warn("⚠️ Missing STRIPE_SECRET_KEY in .env");
}
if (!STRIPE_PRICE_ID) {
  console.warn("⚠️ Missing STRIPE_PRICE_ID in .env");
}

const stripe = isStripeConfigured ? new Stripe(STRIPE_SECRET_KEY) : null;

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

  switch (A[15]?.value) {
    case "a":
      add("clarity", 10); add("consistency", 8); add("confidence", 4);
      break;
    case "b":
      add("consistency", 4); add("clarity", 2);
      break;
    case "c":
      add("consistency", -6); add("availability", -4); add("anxiety", 4);
      break;
    case "d":
      add("consistency", -10); add("availability", -8); add("anxiety", 8);
      break;
  }

  let archetype = "Prietenos dar vag";
  let description = "Ești cald(ă) și plăcut(ă), dar mesajele pot fi neclare.";

  if (traits.anxiety >= 70 && traits.clarity <= 45) {
    archetype = "Mesager supragânditor";
    description = "Analizezi prea mult mesajele și te stresezi după ce le trimiți.";
  } else if (traits.confidence >= 70 && traits.playfulness >= 65) {
    archetype = "Flirter sigur pe sine";
    description = "Ești sigur(ă) pe tine, jucăuș(ă) și comod(ă) cu inițiativa.";
  } else if (traits.consistency <= 40) {
    archetype = "Evitant intermitent";
    description = "Dispari și revii, iar asta rupe conexiunea.";
  } else if (traits.playfulness <= 40) {
    archetype = "Răspuns sec";
    description = "Răspunsurile tale par scurte sau fără emoție.";
  } else if (traits.availability >= 65 && traits.clarity >= 60 && traits.playfulness >= 50) {
    archetype = "Povestitor cald";
    description = "Conectezi prin căldură și conversație bună. Ține mesajele scurte și orientate spre acțiune.";
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
    if (!isStripeConfigured) {
      return res.status(500).json({ error: "Stripe is not configured" });
    }
    const answers = req.body?.answers;

    if (!Array.isArray(answers) || answers.length !== 16) {
      return res.status(400).json({ error: "Invalid answers" });
    }

    const result = scoreAttempt(answers);

    const baseUrl = req.get("origin") || `${req.protocol}://${req.get("host")}`;
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        { price: STRIPE_PRICE_ID, quantity: 1 }
      ],
      success_url: `${baseUrl}/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/?canceled=1`
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
    if (!isStripeConfigured) {
      return res.status(500).json({ paid: false, error: "Stripe is not configured" });
    }
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

// Generate advice text
app.post("/generate-advice", (req, res) => {
  try {
    const archetype = String(req.body?.archetype || "").trim();
    const traits = req.body?.traits || {};

    if (!archetype) {
      return res.status(400).json({ error: "Missing archetype" });
    }

    const topTraits = Object.entries(traits)
      .filter(([, value]) => Number.isFinite(Number(value)))
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .slice(0, 2)
      .map(([key]) => key);

    const adviceByType = {
      "Mesager supragânditor": [
        "Trimite mesaje mai scurte și încheie cu o întrebare clară.",
        "Așteaptă 20–30 de minute înainte de un follow-up.",
        "Începe simplu: „Hey! Cum ți-a fost ziua?”"
      ],
      "Flirter sigur pe sine": [
        "Păstrează flirtul, dar leagă-l de un plan concret.",
        "Evită spamul de mesaje; lasă spațiu să răspundă.",
        "Încearcă: „Pari fun — o cafea săptămâna asta?”"
      ],
      "Evitant intermitent": [
        "Țintește consistența: răspunde în 24h.",
        "Spune o dată intenția: „Îmi place să vorbesc cu tine.”",
        "Propune o întâlnire scurtă, fără presiune."
      ],
      "Răspuns sec": [
        "Adaugă căldură cu un emoji sau un compliment scurt.",
        "Pune întrebări deschise ca să păstrezi ritmul.",
        "Încearcă: „Sună bine — ce te-a făcut să intri în asta?”"
      ],
      "Prietenos dar vag": [
        "Fii direct(ă) despre interes: „Aș vrea să ieșim.”",
        "Înlocuiește hinturile cu planuri concrete.",
        "Închide mesajele cu un pas clar."
      ],
      "Povestitor cald": [
        "Scurtează poveștile și încheie cu o întrebare.",
        "Potrivește ritmul lor; nu spune prea mult prea repede.",
        "Transformă vibe-ul bun într-un plan."
      ]
    };

    const baseAdvice = adviceByType[archetype] || [
      "Păstrează mesajele clare, calde și constante.",
      "Pune o singură întrebare deschisă pe rând.",
      "Propune un plan concret când vibe-ul e bun."
    ];

    const traitTips = [];
    if (topTraits.includes("anxiety")) {
      traitTips.push("Dacă te simți anxios/anxioasă, scrie mesajul și așteaptă 10 minute.");
    }
    if (topTraits.includes("confidence")) {
      traitTips.push("Sprijină încrederea cu o intenție clară.");
    }
    if (topTraits.includes("clarity")) {
      traitTips.push("Ține claritatea sus: o singură idee per mesaj.");
    }
    if (topTraits.includes("consistency")) {
      traitTips.push("Consistența creează încredere: răspunde într-un ritm stabil.");
    }
    if (topTraits.includes("playfulness")) {
      traitTips.push("Adaugă umor ușor sau o glumă legată de mesajul lor.");
    }
    if (topTraits.includes("availability")) {
      traitTips.push("Echilibrează disponibilitatea cu respectul de sine — nu explica prea mult.");
    }

    const adviceText = [
      `Profil: ${archetype}`,
      "",
      "Ce faci mai departe:",
      ...baseAdvice.map((line) => `- ${line}`),
      "",
      "Focus pe trăsături:",
      ...(traitTips.length ? traitTips.map((line) => `- ${line}`) : ["- Ține un ritm echilibrat și rămâi cald(ă)."])
    ].join("\n");

    res.json({ adviceText });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Advice generation failed" });
  }
});

/* --------------------
   Start server
-------------------- */
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
