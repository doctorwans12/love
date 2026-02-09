import OpenAI from "openai";
import type { Archetype, TraitScores } from "./quiz";

const fallbackAdvice = `Practical next steps

- Lead with one clear opener instead of waiting for a perfect moment.
- Use one specific compliment rather than a vague "you seem cool."
- Follow up once after a good exchange to build momentum.
- Ask one curious, light question to keep the conversation moving.
- Match their pace, not their silence — consistency builds trust.
- Keep flirting playful but pair it with warmth.
- If anxiety spikes, pause, breathe, and send a short reply.
- Say what you want clearly and kindly.
- Move from texting to real life with a simple invite.

Two message scripts

1) "Hey! You mentioned you love ___ — I just tried it and thought of you. Want to swap recommendations this week?"
2) "I like talking with you. Want to grab a quick coffee sometime and keep the convo going?"`;

const openaiApiKey = process.env.OPENAI_API_KEY;

const openaiClient = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;

export async function generateAdvice({
  archetype,
  traits
}: {
  archetype: Archetype;
  traits: TraitScores;
}): Promise<string> {
  if (!openaiClient) return fallbackAdvice;

  const prompt = `You are a coach for dating communication. Provide 8-12 practical bullet points and 2 message scripts.

Archetype: ${archetype.name}
Description: ${archetype.description}
Traits: ${JSON.stringify(traits)}

Tone: encouraging, practical, not cringe. Use clear section titles.`;

  const completion = await openaiClient.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7
  });

  return completion.choices[0]?.message?.content?.trim() || fallbackAdvice;
}

export { fallbackAdvice };
