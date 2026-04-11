import { describe, it, expect } from 'vitest';
import { TREATMENTS, BUNDLES, QUESTIONS, SYMPTOM_LABELS } from '../../src/data/index';
import { resolveRecommendation } from '../../src/engine/resolve';
import { scoreSymptoms } from '../../src/engine/scoring';
import type { SingleQuestion } from '../../src/types/question';

// ---------------------------------------------------------------------------
// Path enumeration via DFS
// ---------------------------------------------------------------------------

interface WizardPath {
  questionIds: string[];
  terminalRecommend: string;
}

/**
 * Walk every single-select option from a starting question.
 * Builds a complete list of root-to-leaf paths, where each leaf is an option
 * that carries a `recommend` (terminal). Options with `next` recurse into the
 * next question.
 *
 * The `visited` set prevents infinite loops on the current path, but nodes
 * shared between multiple parents (myersUpgrade, nadDose) are intentionally
 * visited from multiple parent paths -- that is valid and expected.
 */
function enumeratePaths(): WizardPath[] {
  const allPaths: WizardPath[] = [];

  function dfs(questionId: string, pathSoFar: string[], visitedOnPath: Set<string>): void {
    const question = QUESTIONS[questionId as keyof typeof QUESTIONS];
    if (!question) return;
    if (question.type !== 'single') return; // symptoms is multi -- handled separately

    if (visitedOnPath.has(questionId)) {
      // Cycle detected on this path -- do not recurse further
      return;
    }

    const singleQ = question as SingleQuestion;
    const nextVisited = new Set(visitedOnPath);
    nextVisited.add(questionId);
    const currentPath = [...pathSoFar, questionId];

    for (const option of singleQ.options) {
      if (option.recommend) {
        // Terminal: record the path
        allPaths.push({
          questionIds: currentPath,
          terminalRecommend: option.recommend,
        });
      } else if (option.next) {
        dfs(option.next, currentPath, nextVisited);
      }
      // Options with neither next nor recommend are skipped (no forward movement)
    }
  }

  dfs('start', [], new Set<string>());
  return allPaths;
}

describe('Path enumeration', () => {
  const allPaths = enumeratePaths();

  it('enumerates at least 40 unique paths from start', () => {
    expect(allPaths.length).toBeGreaterThanOrEqual(40);
  });

  it('enumerates at most 80 unique paths from start', () => {
    // Actual enumeration across the full tree produces 71 paths.
    // The upper bound guards against accidental infinite expansion if cycles
    // are introduced.
    expect(allPaths.length).toBeLessThanOrEqual(80);
  });

  it('every path has at least one question visited', () => {
    for (const path of allPaths) {
      expect(path.questionIds.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('every path terminates with a recommend (no paths end at a dead-end question)', () => {
    for (const path of allPaths) {
      expect(path.terminalRecommend).toBeTruthy();
    }
  });

  it('every terminal recommend resolves via resolveRecommendation without throwing', () => {
    const uniqueRecommendIds = new Set(allPaths.map((p) => p.terminalRecommend));
    for (const recommendId of uniqueRecommendIds) {
      expect(
        () => resolveRecommendation(recommendId as never, TREATMENTS, BUNDLES),
        `Expected ${recommendId} to resolve without error`,
      ).not.toThrow();
    }
  });

  it('no path visits the same question twice (no cycles on any single path)', () => {
    for (const path of allPaths) {
      const seen = new Set<string>();
      for (const qid of path.questionIds) {
        expect(seen.has(qid), `Cycle: question "${qid}" visited twice in path [${path.questionIds.join(' → ')}]`).toBe(false);
        seen.add(qid);
      }
    }
  });

  it('all paths start from "start" question', () => {
    for (const path of allPaths) {
      expect(path.questionIds[0]).toBe('start');
    }
  });

  it('shared nodes (myersUpgrade, nadDose) are reached by multiple distinct paths', () => {
    const myersUpgradePaths = allPaths.filter((p) =>
      p.questionIds.includes('myersUpgrade'),
    );
    const nadDosePaths = allPaths.filter((p) =>
      p.questionIds.includes('nadDose'),
    );

    expect(myersUpgradePaths.length).toBeGreaterThan(1);
    expect(nadDosePaths.length).toBeGreaterThan(1);
  });

  it('known terminal recommends are present: hangover, beautyBundle, nadPlusLabs, nad100, nad500', () => {
    const terminalIds = new Set(allPaths.map((p) => p.terminalRecommend));
    expect(terminalIds.has('hangover')).toBe(true);
    expect(terminalIds.has('beautyBundle')).toBe(true);
    expect(terminalIds.has('nadPlusLabs')).toBe(true);
    expect(terminalIds.has('nad100')).toBe(true);
    expect(terminalIds.has('nad500')).toBe(true);
  });

  it('all 4 lab results are reachable', () => {
    const terminalIds = new Set(allPaths.map((p) => p.terminalRecommend));
    expect(terminalIds.has('labGeneral')).toBe(true);
    expect(terminalIds.has('labInDepth')).toBe(true);
    expect(terminalIds.has('labVitamin')).toBe(true);
    expect(terminalIds.has('labComplete')).toBe(true);
  });

  it('all 6 quick injection results are reachable', () => {
    const terminalIds = new Set(allPaths.map((p) => p.terminalRecommend));
    expect(terminalIds.has('b12Shot')).toBe(true);
    expect(terminalIds.has('glutathioneShot')).toBe(true);
    expect(terminalIds.has('triImmuneShot')).toBe(true);
    expect(terminalIds.has('vitaminDShot')).toBe(true);
    expect(terminalIds.has('biotinShot')).toBe(true);
    expect(terminalIds.has('lipoShots')).toBe(true);
  });
});

describe('Symptom scoring paths', () => {
  it('each individual symptom produces at least 1 result', () => {
    for (const symptom of SYMPTOM_LABELS) {
      const result = scoreSymptoms([symptom], TREATMENTS);
      expect(
        result.results.length,
        `Expected at least 1 result for symptom "${symptom}"`,
      ).toBeGreaterThan(0);
    }
  });

  it('all 10 symptoms selected together: produces results and primaryTreatmentId is set', () => {
    const result = scoreSymptoms([...SYMPTOM_LABELS], TREATMENTS);
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.primaryTreatmentId).not.toBeNull();
  });

  it('all symptom results resolve via resolveRecommendation', () => {
    for (const symptom of SYMPTOM_LABELS) {
      const { results } = scoreSymptoms([symptom], TREATMENTS);
      for (const candidate of results) {
        expect(
          () => resolveRecommendation(candidate.treatmentId, TREATMENTS, BUNDLES),
        ).not.toThrow();
      }
    }
  });

  it('primaryTreatmentId matches the first result when results are non-empty', () => {
    for (const symptom of SYMPTOM_LABELS) {
      const result = scoreSymptoms([symptom], TREATMENTS);
      if (result.results.length > 0) {
        expect(result.primaryTreatmentId).toBe(result.results[0].treatmentId);
      }
    }
  });

  it('scoring for "Dehydrated / dry all the time" returns hydration in results', () => {
    const result = scoreSymptoms(['Dehydrated / dry all the time'], TREATMENTS);
    // hydration (5) should be the top iv scorer, beating myers (3) and altitude (2)
    const ivResult = result.results.find((r) => r.category === 'iv');
    expect(ivResult?.treatmentId).toBe('hydration');
  });

  it('scoring for "Struggling with weight" returns semaglutide as top weightLoss result', () => {
    const result = scoreSymptoms(['Struggling with weight'], TREATMENTS);
    const weightResult = result.results.find((r) => r.category === 'weightLoss');
    expect(weightResult?.treatmentId).toBe('semaglutide');
    expect(weightResult?.score).toBe(5);
  });
});
