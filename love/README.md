# How Do You Talk to the Person You Like?

Production-ready Next.js (App Router) app for a dating / social skills personality test.

## Features
- Mobile-first landing page and quiz flow
- 14-question test (choice + scale questions) with trait scoring
- Stripe Checkout paywall (one-time EUR payment)
- Results + advice pages gated by payment status
- OpenAI advice generation with database caching + fallback advice
- Prisma + SQLite for local development

## Local setup

1) Install dependencies
```bash
npm install
```

2) Configure environment variables
```bash
cp .env.example .env
```

3) Create the database
```bash
npx prisma migrate dev --name init
```

4) Start the dev server
```bash
npm run dev
```

## Environment variables
```
DATABASE_URL="file:./dev.db"
BASE_URL="http://localhost:3000"
STRIPE_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
PRICE_ID_EUR="price_..."
STRIPE_WEBHOOK_SECRET="whsec_..." # optional
OPENAI_API_KEY="sk-..." # optional
```

## Railway deployment
- This repo includes `railway.toml` for Nixpacks-based builds.
- Set the same environment variables in Railway before deploying.
- Recommended build/start commands are handled automatically, but you can override them with:
  - Build: `npm run build`
  - Start: `npm run start`

## Project structure
```
app/
  page.tsx
  test/page.tsx
  results/page.tsx
  advice/page.tsx
  api/
    checkout-session/route.ts
    generate-advice/route.ts
components/
  Button.tsx
  ProgressBar.tsx
lib/
  advice.ts
  prisma.ts
  quiz.ts
  stripe.ts
prisma/
  schema.prisma
```

## Stripe flow
- `/api/checkout-session` creates the Checkout Session and saves an `Attempt` record.
- `/results` verifies `session_id` with Stripe and gates the results.
- `/advice` verifies `session_id` and generates advice (cached in DB).

## Prisma schema
See `prisma/schema.prisma` for the `Attempt` model.
