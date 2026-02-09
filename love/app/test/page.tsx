"use client";

import { useMemo, useState } from "react";
import { PrimaryButton, SecondaryButton } from "@/components/Button";
import { ProgressBar } from "@/components/ProgressBar";
import { questions } from "@/lib/quiz";

export default function TestPage() {
  const total = questions.length;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isComplete = currentIndex >= total;
  const progressValue = useMemo(() => Math.round((currentIndex / total) * 100), [currentIndex, total]);

  const currentQuestion = questions[currentIndex];
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : undefined;

  const handleAnswer = (value: number) => {
    if (!currentQuestion) return;
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: value }));
  };

  const handleNext = () => {
    if (currentIndex < total) setCurrentIndex((prev) => prev + 1);
  };

  const handleBack = () => {
    if (currentIndex > 0) setCurrentIndex((prev) => prev - 1);
  };

  const handleCheckout = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers })
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload?.error || "Unable to start checkout.");
      }

      const payload = await response.json();
      if (payload?.url) {
        window.location.href = payload.url as string;
      } else {
        throw new Error("Missing checkout url.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mx-auto flex min-h-screen max-w-3xl flex-col gap-10 px-6 py-12">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold text-ink">Dating communication test</h1>
        <p className="text-slate-600">
          Answer each question honestly. You can go back at any time before checkout.
        </p>
      </header>

      <ProgressBar value={progressValue} />

      {!isComplete && currentQuestion && (
        <div className="rounded-3xl bg-white p-8 shadow-soft">
          <div className="mb-6 text-sm text-slate-500">
            Question {currentIndex + 1} of {total}
          </div>
          <h2 className="text-xl font-semibold text-ink">{currentQuestion.prompt}</h2>

          <div className="mt-6 flex flex-col gap-3">
            {currentQuestion.type === "choice" &&
              currentQuestion.options?.map((option, optionIndex) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => handleAnswer(optionIndex)}
                  className={`rounded-2xl border px-4 py-3 text-left text-sm transition hover:border-accent hover:bg-soft ${
                    currentAnswer === optionIndex
                      ? "border-accent bg-soft"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  {option.label}
                </button>
              ))}

            {currentQuestion.type === "scale" && (
              <div className="space-y-4">
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={currentAnswer ?? 3}
                  onChange={(event) => handleAnswer(Number(event.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-slate-500">
                  <span>{currentQuestion.scaleLabels?.[0]}</span>
                  <span>{currentQuestion.scaleLabels?.[1]}</span>
                </div>
              </div>
            )}
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
            <SecondaryButton type="button" onClick={handleBack} disabled={currentIndex === 0}>
              Back
            </SecondaryButton>
            <PrimaryButton
              type="button"
              onClick={handleNext}
              disabled={currentAnswer === undefined}
            >
              Next
            </PrimaryButton>
          </div>
        </div>
      )}

      {isComplete && (
        <div className="rounded-3xl bg-white p-10 text-center shadow-soft">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            Almost done
          </p>
          <h2 className="mt-4 text-2xl font-semibold text-ink">
            Ready to see your communication archetype?
          </h2>
          <p className="mt-4 text-slate-600">
            Your answers are saved. Continue to unlock your results and personalized advice.
          </p>
          {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
          <div className="mt-8 flex justify-center">
            <PrimaryButton type="button" onClick={handleCheckout} disabled={loading}>
              {loading ? "Redirecting..." : "See the results"}
            </PrimaryButton>
          </div>
        </div>
      )}
    </section>
  );
}
