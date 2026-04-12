import type { TreatmentId, Treatment } from '../types/treatment';
import type { BundleId, Bundle } from '../types/bundle';
import type { QuestionId, Question } from '../types/question';

export interface WizardRemoteConfig {
  treatments: Record<string, Treatment>;
  bundles: Record<string, Bundle>;
  questions: Record<string, Question>;
  meta?: Record<string, unknown>;
}

interface CompiledConfig {
  treatments: Readonly<Record<TreatmentId, Treatment>>;
  bundles: Readonly<Record<BundleId, Bundle>>;
  questions: Readonly<Record<QuestionId, Question>>;
}

/**
 * Fetch wizard config from a Cloudflare Worker.
 * Returns parsed JSON on success, null on any error (network, parse, timeout).
 */
export async function fetchRemoteConfig(workerUrl: string): Promise<WizardRemoteConfig | null> {
  try {
    const res = await fetch(`${workerUrl}/config`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const data: WizardRemoteConfig = await res.json();
    return data;
  } catch {
    return null;
  }
}

/**
 * Merge remote config with compiled defaults.
 * Remote wins per top-level key; compiled fills any missing keys.
 */
export function mergeWithDefaults(
  remote: WizardRemoteConfig,
  compiled: CompiledConfig,
): WizardRemoteConfig {
  return {
    treatments: remote.treatments && Object.keys(remote.treatments).length > 0
      ? remote.treatments
      : { ...compiled.treatments },
    bundles: remote.bundles && Object.keys(remote.bundles).length > 0
      ? remote.bundles
      : { ...compiled.bundles },
    questions: remote.questions && Object.keys(remote.questions).length > 0
      ? remote.questions
      : { ...compiled.questions },
    meta: remote.meta,
  };
}
