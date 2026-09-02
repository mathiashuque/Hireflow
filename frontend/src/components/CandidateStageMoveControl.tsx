"use client";

import { useId, useState } from "react";
import { CANDIDATE_STAGES, type CandidateStage } from "@/lib/api/candidates";
import { Button } from "@/components/ui/Button";
import { AnimatedStatus } from "@/components/ui/StatusBanner";
import { useI18n } from "@/i18n/LocaleProvider";
import { candidateStageLabel } from "@/i18n/enumLabels";

type CandidateStageMoveControlProps = {
  currentStage: CandidateStage;
  disabled?: boolean;
  onMove: (target: CandidateStage) => Promise<void>;
  labelPrefix?: string;
};

/** An explicit, keyboard-accessible stage select plus Move button — the required non-drag way to move a candidate. */
export function CandidateStageMoveControl({ currentStage, disabled, onMove, labelPrefix }: CandidateStageMoveControlProps) {
  const { dict } = useI18n();
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
      setError(submitError instanceof Error ? submitError.message : dict.common.genericError);
    } finally {
      setIsMoving(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <label htmlFor={selectId} className="sr-only">
          {labelPrefix ? `${labelPrefix} ${dict.candidates.moveStage.toLowerCase()}` : dict.candidates.moveTo}
        </label>
        <select
          id={selectId}
          value={target}
          onChange={(event) => setTarget(event.target.value as CandidateStage)}
          disabled={disabled || isMoving}
          className="rounded-lg border border-border-strong bg-surface px-2 py-1 text-xs text-text-primary outline-none transition focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand-soft disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-text-muted"
        >
          {CANDIDATE_STAGES.map((stage) => (
            <option key={stage} value={stage}>
              {candidateStageLabel(dict, stage)}
            </option>
          ))}
        </select>
        <Button size="sm" variant="primary" disabled={disabled || isMoving || isNoOp} onClick={handleMove}>
          {isMoving ? dict.candidates.moving : dict.candidates.move}
        </Button>
      </div>
      <AnimatedStatus id={error}>
        <p role="alert" className="text-xs text-danger-text">
          {error}
        </p>
      </AnimatedStatus>
    </div>
  );
}
