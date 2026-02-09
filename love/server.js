// server.js
require("dotenv").config();

const express = require("express");
const path = require("path");
const Stripe = require("stripe");

// ---- VALIDARE ENV (ca să nu pornești serverul “în gol”) ----
const REQUIRED_ENVS = [
  "STRIPE_SECRET_KEY",
  "PRICE_ID_ONCE"
];

for (const k of REQUIRED_ENVS) {
  if (!process.env[k]) {
    console.error(`❌ Missing env var: ${k}`);
    process.exit(1);
  }
}

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// ---- APP ----
const app = express();
app.set("trust proxy", 1);

// Static files (index.html, logo.png, favicon.png etc.)
app.use(express.static(__dirname));

// ---- HELPERS ----
const allowedPlans = new Set(["A", "B", "C", "D"]);

function getBaseUrl(req) {
  // Dacă ai BASE_URL în env (pentru deploy), îl folosim.
  // Altfel, îl construim din request.
  const forwardedProto = req.get("x-forwarded-proto");
  const protocol = forwardedProto ? forwardedProto.split(",")[0] : req.protocol;
  return process.env.BASE_URL || `${protocol}://${req.get("host")}`;
}

// ---- ROUTES ----
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Optional: status route (debug)
app.get("/health", (req, res) => {
  res.json({
    ok: true,
  });
});

// 1) PAYMENT SESSION
// Frontend calls: /pay-session?choice=A
app.get("/pay-session", async (req, res) => {
  const choice = (req.query.choice || "").trim();

  // validate choice (so you don’t store junk)
  if (!allowedPlans.has(choice)) {
    return res.status(400).send("Invalid plan/choice.");
  }

  const priceId = process.env.PRICE_ID_ONCE;

  try {
    const baseUrl = getBaseUrl(req);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "payment",

      // helpful metadata
      metadata: {
        plan: choice,
      },

      success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}&plan=${encodeURIComponent(choice)}`,
      cancel_url: `${baseUrl}/`,
    });

    return res.redirect(303, session.url);
  } catch (err) {
    console.error("Stripe Error:", err.message);
    return res.status(500).send("Stripe error.");
  }
});

// 2) SUCCESS
app.get("/success", async (req, res) => {
  const { session_id, plan } = req.query;

  if (!session_id) return res.redirect("/");

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);
    const sessionPlan = session?.metadata?.plan;
    const resolvedPlan = sessionPlan || plan || "";
    const redirectPlan = allowedPlans.has(resolvedPlan) ? resolvedPlan : "";

    // redirect back to frontend with params
    return res.redirect(`/?session_id=${encodeURIComponent(session_id)}&plan=${encodeURIComponent(redirectPlan)}`);
  } catch (err) {
    console.error("Success Route Error:", err.message);
    return res.redirect("/");
  }
});

// ---- START ----
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
