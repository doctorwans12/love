"use strict";

require("dotenv").config();
const path = require("path");
const express = require("express");
const Stripe = require("stripe");

const PORT = Number(process.env.PORT || 3000);
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID;

if (!STRIPE_SECRET_KEY) {
  console.error("❌ Missing STRIPE_SECRET_KEY");
  process.exit(1);
}
if (!STRIPE_PRICE_ID) {
  console.error("❌ Missing STRIPE_PRICE_ID");
  process.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET_KEY);

const app = express();
app.set("trust proxy", 1);

// STATIC (index.html + imagini)
app.use(express.static(__dirname, { extensions: ["html"] }));

app.get("/health", (req, res) => res.json({ ok: true }));

function getBaseUrl(req) {
  const xfProto = req.get("x-forwarded-proto");
  const protocol = xfProto ? xfProto.split(",")[0].trim() : req.protocol;
  return `${protocol}://${req.get("host")}`;
}

// HOME
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// STRIPE: create checkout session
app.get("/pay-session", async (req, res) => {
  try {
    const choice = String(req.query.choice || "").trim().toUpperCase();
    const allowed = new Set(["A", "B", "C", "D"]);
    if (!allowed.has(choice)) return res.status(400).send("Invalid choice.");

    const baseUrl = getBaseUrl(req);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
      metadata: { plan: choice },
      success_url: `${baseUrl}/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/?canceled=1`,
    });

    return res.redirect(303, session.url);
  } catch (err) {
    console.error("Stripe /pay-session error:", err);
    return res.status(500).send("Stripe error creating checkout session.");
  }
});

// STRIPE: verify session
app.get("/verify-session", async (req, res) => {
  try {
    const sessionId = String(req.query.session_id || "").trim();
    if (!sessionId) return res.status(400).json({ paid: false, error: "Missing session_id" });

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const paid = session.payment_status === "paid";
    const plan = session?.metadata?.plan || null;

    return res.json({ paid, plan });
  } catch (err) {
    console.error("Stripe /verify-session error:", err);
    return res.status(500).json({ paid: false, error: "Verify failed" });
  }
});

// IMPORTANT pentru deploy: ascultă pe 0.0.0.0 și PORT din env
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
