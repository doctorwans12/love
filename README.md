# Love Talk Test

Single-page dating communication test with a Stripe paywall and AI advice.

## Local setup

1) Install dependencies
```bash
npm install
```

2) Configure environment variables
```bash
cp .env.example .env
```

3) Start the server
```bash
npm start
```

## Environment variables
```
PORT=3000
BASE_URL="http://localhost:3000"
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_PRICE_ID="price_..."
OPENAI_API_KEY="sk-..." # optional
```

## Railway deployment
- This repo includes `railway.toml` for Nixpacks-based builds.
- Set the same environment variables in Railway before deploying.
- Recommended build/start commands are handled automatically, but you can override them with:
  - Start: `npm start`
