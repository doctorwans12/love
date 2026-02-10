"use strict";

require("dotenv").config();
const express = require("express");
const path = require("path");
const Stripe = require("stripe");

const app = express();
const PORT = process.env.PORT || 3000;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

app.use(express.static(__dirname));

app.get("/", (_, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/pay-session", async (req, res) => {
  const choice = req.query.choice;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
    metadata: { plan: choice },
    success_url: `${req.protocol}://${req.get("host")}/?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${req.protocol}://${req.get("host")}/`,
  });

  res.redirect(session.url);
});

app.get("/verify-session", async (req, res) => {
  const session = await stripe.checkout.sessions.retrieve(req.query.session_id);
  res.json({
    paid: session.payment_status === "paid",
    plan: session.metadata.plan
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("SERVER PORNIT");
});
