"use client";

import { useId, useState } from "react";
import { CANDIDATE_STAGES, type CandidateStage } from "@/lib/api/candidates";

type CandidateStageMoveControlProps = {
  currentStage: CandidateStage;
  disabled?: boolean;
  onMove: (target: CandidateStage) => Promise<void>;
  labelPrefix?: string;
};

/** An explicit, keyboard-accessible stage select plus Move button — the required non-drag way to move a candidate. */
export function CandidateStageMoveControl({ currentStage, disabled, onMove, labelPrefix }: CandidateStageMoveControlProps) {
  const selectId = useId();
  const [target, setTarget] = useState<CandidateStage>(currentStage);
  const [isMoving, setIsMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isNoOp = target === currentStage;

  async function handleMove() {
    if (isNoOp || isMoving) {
      return;
    }

    setError(null);
    setIsMoving(true);
    try {
      await onMove(target);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Something went wrong. Please try again.");
    } finally {
      setIsMoving(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <label htmlFor={selectId} className="sr-only">
          {labelPrefix ? `${labelPrefix} stage` : "Move to stage"}
        </label>
        <select
          id={selectId}
          value={target}
          onChange={(event) => setTarget(event.target.value as CandidateStage)}
          disabled={disabled || isMoving}
          className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-950 outline-none transition focus-visible:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
        >
          {CANDIDATE_STAGES.map((stage) => (
            <option key={stage} value={stage}>
              {stage}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleMove}
          disabled={disabled || isMoving || isNoOp}
          className="rounded-lg bg-slate-900 px-3 py-1 text-xs font-medium text-white transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isMoving ? "Moving…" : "Move"}
        </button>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
