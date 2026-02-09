export type TraitKey =
  | "confidence"
  | "clarity"
  | "playfulness"
  | "emotionalAvailability"
  | "consistency"
  | "anxiety";

export type TraitScores = Record<TraitKey, number>;

export type QuestionOption = {
  label: string;
  weights: Partial<Record<TraitKey, number>>;
};

export type Question = {
  id: string;
  prompt: string;
  type: "choice" | "scale";
  options?: QuestionOption[];
  scaleLabels?: [string, string];
  scaleWeights?: Partial<Record<TraitKey, number>>;
};

export const questions: Question[] = [
  {
    id: "q1",
    prompt: "When you want to start a conversation, you usually…",
    type: "choice",
    options: [
      {
        label: "Send a direct opener with a clear purpose.",
        weights: { confidence: 8, clarity: 6 }
      },
      {
        label: "Start with a light joke or meme.",
        weights: { playfulness: 8, confidence: 3 }
      },
      {
        label: "Wait for the right moment and overthink it.",
        weights: { anxiety: 8, confidence: -4 }
      },
      {
        label: "Reply to a story and keep it short.",
        weights: { clarity: 2, consistency: 2 }
      }
    ]
  },
  {
    id: "q2",
    prompt: "How do you respond to being left on seen?",
    type: "choice",
    options: [
      {
        label: "Follow up once with something new.",
        weights: { consistency: 6, confidence: 4 }
      },
      {
        label: "Assume they are busy and wait.",
        weights: { anxiety: 3, consistency: -2 }
      },
      {
        label: "Stop replying entirely.",
        weights: { consistency: -6, clarity: -2 }
      },
      {
        label: "Send a playful check-in.",
        weights: { playfulness: 6, confidence: 2 }
      }
    ]
  },
  {
    id: "q3",
    prompt: "Rate how comfortable you are flirting in text.",
    type: "scale",
    scaleLabels: ["Not comfortable", "Very comfortable"],
    scaleWeights: { confidence: 8, playfulness: 6, anxiety: -6 }
  },
  {
    id: "q4",
    prompt: "Compliments you give are usually…",
    type: "choice",
    options: [
      {
        label: "Specific and personal.",
        weights: { clarity: 6, emotionalAvailability: 4 }
      },
      {
        label: "Playful but vague.",
        weights: { playfulness: 6, clarity: -2 }
      },
      {
        label: "Rare, I keep it neutral.",
        weights: { anxiety: 4, emotionalAvailability: -4 }
      },
      {
        label: "Warm and direct.",
        weights: { confidence: 4, emotionalAvailability: 5 }
      }
    ]
  },
  {
    id: "q5",
    prompt: "Rate your level of social anxiety on dates.",
    type: "scale",
    scaleLabels: ["Low", "High"],
    scaleWeights: { anxiety: 10, confidence: -6 }
  },
  {
    id: "q6",
    prompt: "Humor in your conversations feels…",
    type: "choice",
    options: [
      { label: "Natural and frequent.", weights: { playfulness: 8 } },
      { label: "Occasional but safe.", weights: { playfulness: 3, anxiety: 2 } },
      { label: "Forced, I avoid it.", weights: { playfulness: -4, anxiety: 4 } },
      { label: "Witty and flirty.", weights: { playfulness: 7, confidence: 3 } }
    ]
  },
  {
    id: "q7",
    prompt: "How open are you about feelings early on?",
    type: "scale",
    scaleLabels: ["Not open", "Very open"],
    scaleWeights: { emotionalAvailability: 10, clarity: 4 }
  },
  {
    id: "q8",
    prompt: "Consistency in your replies is…",
    type: "choice",
    options: [
      { label: "Steady and reliable.", weights: { consistency: 8 } },
      { label: "On and off depending on mood.", weights: { consistency: -6, anxiety: 4 } },
      { label: "Low, I forget to reply.", weights: { consistency: -8 } },
      { label: "Quick bursts, then silence.", weights: { consistency: -4, playfulness: 2 } }
    ]
  },
  {
    id: "q9",
    prompt: "Boundaries for you sound like…",
    type: "choice",
    options: [
      { label: "Clear and calm.", weights: { clarity: 8, confidence: 3 } },
      { label: "I avoid them to keep things light.", weights: { clarity: -6, playfulness: 2 } },
      { label: "I set them late or not at all.", weights: { clarity: -4, anxiety: 4 } },
      { label: "Honest and kind.", weights: { emotionalAvailability: 4, clarity: 4 } }
    ]
  },
  {
    id: "q10",
    prompt: "Texting vs real life — you prefer to…",
    type: "choice",
    options: [
      { label: "Move to a real-life plan quickly.", weights: { confidence: 6, clarity: 5 } },
      { label: "Keep texting until it's obvious.", weights: { anxiety: 4, consistency: 2 } },
      { label: "Stay in text because it's safer.", weights: { anxiety: 6, confidence: -4 } },
      { label: "Mix both equally.", weights: { consistency: 4, clarity: 3 } }
    ]
  },
  {
    id: "q11",
    prompt: "Rate how clear you are about your intentions.",
    type: "scale",
    scaleLabels: ["Not clear", "Very clear"],
    scaleWeights: { clarity: 10, confidence: 4 }
  },
  {
    id: "q12",
    prompt: "When a conversation slows, you…",
    type: "choice",
    options: [
      { label: "Ask a thoughtful question.", weights: { clarity: 4, emotionalAvailability: 4 } },
      { label: "Send a light meme.", weights: { playfulness: 5 } },
      { label: "Let it fade.", weights: { consistency: -6 } },
      { label: "Worry and overthink it.", weights: { anxiety: 6 } }
    ]
  },
  {
    id: "q13",
    prompt: "How confident do you feel approaching someone new in person?",
    type: "scale",
    scaleLabels: ["Not confident", "Very confident"],
    scaleWeights: { confidence: 12, anxiety: -6 }
  },
  {
    id: "q14",
    prompt: "Your emotional openness in conversations is…",
    type: "scale",
    scaleLabels: ["Guarded", "Open"],
    scaleWeights: { emotionalAvailability: 10, confidence: 2 }
  }
];

const baseTraits: TraitScores = {
  confidence: 50,
  clarity: 50,
  playfulness: 50,
  emotionalAvailability: 50,
  consistency: 50,
  anxiety: 50
};

export function scoreAnswers(answers: Record<string, number>): TraitScores {
  const traits: TraitScores = { ...baseTraits };

  questions.forEach((question) => {
    const value = answers[question.id];
    if (value === undefined || value === null) return;

    if (question.type === "choice" && question.options) {
      const option = question.options[value];
      if (!option) return;
      Object.entries(option.weights).forEach(([trait, delta]) => {
        traits[trait as TraitKey] += delta ?? 0;
      });
    }

    if (question.type === "scale" && question.scaleWeights) {
      const normalized = Math.max(1, Math.min(5, value));
      const factor = (normalized - 3) / 2;
      Object.entries(question.scaleWeights).forEach(([trait, weight]) => {
        traits[trait as TraitKey] += (weight ?? 0) * factor;
      });
    }
  });

  (Object.keys(traits) as TraitKey[]).forEach((trait) => {
    traits[trait] = Math.round(Math.max(0, Math.min(100, traits[trait])));
  });

  return traits;
}

export type Archetype = {
  name: string;
  description: string;
  strengths: string[];
  risks: string[];
  improvements: string[];
};

export const archetypes: Archetype[] = [
  {
    name: "Overthinker Texter",
    description: "You care deeply, but your mind spins when messages slow down.",
    strengths: ["Thoughtful", "Empathetic", "Detail-oriented"],
    risks: ["Analysis paralysis", "Second-guessing every reply"],
    improvements: ["Send the simple reply", "Trust small momentum", "Detach from instant validation"]
  },
  {
    name: "Confident Flirter",
    description: "You are direct, playful, and make people feel chosen.",
    strengths: ["Bold communication", "Lighthearted energy", "Clear intent"],
    risks: ["Moving too fast", "Missing quieter signals"],
    improvements: ["Balance teasing with warmth", "Ask more curious questions"]
  },
  {
    name: "Friendly but Vague",
    description: "You are kind and approachable, but your intentions can be hard to read.",
    strengths: ["Warmth", "Easy to talk to", "Low pressure"],
    risks: ["Mixed signals", "Being seen as just a friend"],
    improvements: ["Be clearer about interest", "Give one direct compliment"]
  },
  {
    name: "Dry Responder",
    description: "You keep it short and calm, which can feel distant to others.",
    strengths: ["Low drama", "Efficient communicator"],
    risks: ["Appearing uninterested", "Losing momentum"],
    improvements: ["Add one curious question", "Show one emotion per convo"]
  },
  {
    name: "Warm Storyteller",
    description: "You connect with detail and emotional openness that feels safe.",
    strengths: ["Depth", "Storytelling", "Emotional warmth"],
    risks: ["Over-sharing too early", "Carrying conversations alone"],
    improvements: ["Check pacing", "Invite them to share too"]
  },
  {
    name: "Avoidant Checker",
    description: "You check in but keep things at arm's length.",
    strengths: ["Independent", "Self-protective", "Clear boundaries"],
    risks: ["Emotional distance", "Mixed effort signals"],
    improvements: ["Share one honest feeling", "Follow through on plans"]
  }
];

export function determineArchetype(traits: TraitScores): Archetype {
  if (traits.anxiety >= 70 && traits.clarity <= 45) return archetypes[0];
  if (traits.confidence >= 70 && traits.playfulness >= 65) return archetypes[1];
  if (traits.emotionalAvailability >= 70) return archetypes[4];
  if (traits.consistency <= 40 && traits.confidence <= 55) return archetypes[3];
  if (traits.consistency <= 45 && traits.clarity <= 50) return archetypes[5];
  return archetypes[2];
}
