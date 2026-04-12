/**
 * pathResolver.ts -- Shared path-walking utility for the wizard dev tools.
 *
 * Walks the question graph from 'start', collecting all complete paths to
 * terminal nodes (treatments or bundles). Bundles are expanded to their
 * constituent treatment IDs for coverage analysis.
 *
 * Used by: WizardDevDashboard, PathsTab, EditorMain.
 */

import type { Question, SingleQuestion, QuestionId } from '../types/question';
import type { Bundle, BundleId } from '../types/bundle';
import type { Treatment, TreatmentId } from '../types/treatment';

// ── Types ─────────────────────────────────────────────────────────────────────

/** A resolved path from start to a terminal (treatment or bundle). */
export interface ResolvedPath {
  steps: string[];                    // question IDs + option labels interleaved
  terminal: string;                   // treatment or bundle ID
  terminalKind: 'treatment' | 'bundle';
  /** Bundle-expanded treatment IDs reachable via this path. For a direct
   *  treatment terminal, this is [terminal]. For a bundle terminal, this is
   *  [bundle.primary] and, if present, [bundle.addOn]. */
  resolvedTreatmentIds: string[];
}

// ── computeAllPaths ───────────────────────────────────────────────────────────

/**
 * Walk the question graph from 'start' and collect all complete paths to
 * terminal nodes. Returns an array of ResolvedPath objects.
 * Cycle detection prevents infinite loops.
 */
export function computeAllPaths(
  questions: Readonly<Record<string, Question>>,
  bundles: Readonly<Record<string, Bundle>>,
): ResolvedPath[] {
  const paths: ResolvedPath[] = [];

  function walk(
    qid: string,
    currentSteps: string[],
    visitedQuestions: Set<string>,
  ): void {
    if (visitedQuestions.has(qid)) return; // cycle guard

    const q = questions[qid as QuestionId] as Question | undefined;
    if (!q || q.type !== 'single') return; // symptoms question has no direct paths

    const newVisited = new Set(visitedQuestions);
    newVisited.add(qid);

    for (const opt of (q as SingleQuestion).options) {
      const stepsWithOption = [...currentSteps, qid, opt.label];
      if (opt.recommend) {
        const isBundle = opt.recommend in bundles;
        let resolvedTreatmentIds: string[];
        if (isBundle) {
          const bundle = bundles[opt.recommend as BundleId] as Bundle;
          resolvedTreatmentIds = [bundle.primary];
          if (bundle.addOn) resolvedTreatmentIds.push(bundle.addOn);
        } else {
          resolvedTreatmentIds = [opt.recommend];
        }
        paths.push({
          steps: stepsWithOption,
          terminal: opt.recommend,
          terminalKind: isBundle ? 'bundle' : 'treatment',
          resolvedTreatmentIds,
        });
      } else if (opt.next) {
        walk(opt.next, stepsWithOption, newVisited);
      }
    }
  }

  walk('start', [], new Set());
  return paths;
}

// ── pathsForTreatment ─────────────────────────────────────────────────────────

/**
 * Filter paths that resolve to the given treatment ID, either directly
 * (treatment terminal) or via a bundle that includes it.
 */
export function pathsForTreatment(id: string, paths: ResolvedPath[]): ResolvedPath[] {
  return paths.filter((p) => p.resolvedTreatmentIds.includes(id));
}

// ── reachableTreatmentIds ─────────────────────────────────────────────────────

/**
 * Return the union of all resolvedTreatmentIds across all paths.
 */
export function reachableTreatmentIds(paths: ResolvedPath[]): Set<string> {
  const reachable = new Set<string>();
  for (const p of paths) {
    for (const id of p.resolvedTreatmentIds) {
      reachable.add(id);
    }
  }
  return reachable;
}

// ── orphanedTreatments ────────────────────────────────────────────────────────

/**
 * Return treatments not in the reachable set (not reachable via any wizard path).
 */
export function orphanedTreatments(
  paths: ResolvedPath[],
  treatments: Readonly<Record<string, Treatment>>,
): Treatment[] {
  const reachable = reachableTreatmentIds(paths);
  return Object.values(treatments).filter((t) => !reachable.has((t as Treatment).id)) as Treatment[];
}
