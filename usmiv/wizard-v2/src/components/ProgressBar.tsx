import React from 'react';
import { RULES } from '../constants/rules';

interface ProgressBarProps {
  stepNumber: number;
  isResult: boolean;
}

export function ProgressBar({ stepNumber, isResult }: ProgressBarProps): React.ReactElement {
  let pct: number;
  if (isResult) {
    pct = 100;
  } else {
    const raw = (stepNumber / RULES.EXPECTED_MAX_STEPS) * 100;
    pct = Math.min(raw, 90);
  }

  return (
    <div className="tw-progress">
      <div
        className="tw-progress-track"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Wizard progress"
      >
        <div
          className="tw-progress-fill"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
