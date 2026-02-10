"use strict";

require("dotenv").config();
const path = require("path");
const express = require("express");
const Stripe = require("stripe");

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

const app = express();
app.set("trust proxy", 1);

// static: index.html, logo.png, favicon.png
app.use(express.static(__dirname, { extensions: ["html"] }));

app.get("/health", (req, res) => res.json({ ok: true }));

function getBaseUrl(req) {
  const xfProto = req.get("x-forwarded-proto");
  const protocol = xfProto ? xfProto.split(",")[0].trim() : req.protocol;
  return `${protocol}://${req.get("host")}`;
}

app.get("/", (req, res) => {
  res.sendFile(path.join(
