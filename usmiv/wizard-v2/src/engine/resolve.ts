import type { TreatmentId, Treatment } from '../types/treatment';
import type { Bundle, ResolvedRecommendation } from '../types/bundle';
import type { RecommendId } from '../types/question';

export function resolveRecommendation(
  id: RecommendId,
  treatments: Readonly<Record<TreatmentId, Treatment>>,
  bundles: Readonly<Record<string, Bundle>>,
): ResolvedRecommendation {
  // Check bundles first
  if (id in bundles) {
    const bundle = bundles[id as keyof typeof bundles];
    const primary = treatments[bundle.primary];
    const addOn = bundle.addOn ? (treatments[bundle.addOn] ?? null) : null;
    return { kind: 'bundle', bundle, primary, addOn };
  }

  // Check treatments
  if (id in treatments) {
    return { kind: 'treatment', treatment: treatments[id as TreatmentId] };
  }

  // v1 had a silent Myers' fallback here. v2 surfaces the error.
  // This branch should never be reached if TypeScript types are correct.
  // If it is, the SET_ERROR action shows a user-visible message.
  throw new Error(`Unknown recommendation ID: ${id}. This is a data configuration error.`);
}
