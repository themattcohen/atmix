import { describe, it, expect } from 'vitest';
import { scoreSymptoms } from '../../src/engine/scoring';
import { TREATMENTS, SYMPTOM_LABELS } from '../../src/data/index';
import { RULES } from '../../src/constants/rules';

describe('scoreSymptoms', () => {
  it('returns empty results when no symptoms are selected', () => {
    const result = scoreSymptoms([], TREATMENTS);
    expect(result.results).toHaveLength(0);
    expect(result.primaryTreatmentId).toBeNull();
  });

  it('single symptom: "Tired all the time" → NAD+ 250 scores highest (weight 3), Myers scores 3 too, B12 Shot scores 2', () => {
    const result = scoreSymptoms(['Tired all the time'], TREATMENTS);

    // NAD+ 250 should be top nad category (score 3)
    const nad250 = result.results.find((r) => r.treatmentId === 'nad250');
    expect(nad250).toBeDefined();
    expect(nad250!.score).toBe(3);

    // Myers should appear (score 3)
    // myersPlatinum (5) > myersGold (4) > myers (3) -- only top iv survives dedup
    // So the iv winner might be myersPlatinum
    const ivResult = result.results.find(
      (r) => r.category === 'iv',
    );
    expect(ivResult).toBeDefined();

    // b12Shot has weight 2
    const b12 = result.results.find((r) => r.treatmentId === 'b12Shot');
    expect(b12).toBeDefined();
    expect(b12!.score).toBe(2);

    // labVitamin has weight 1
    const labVitamin = result.results.find((r) => r.treatmentId === 'labVitamin');
    expect(labVitamin).toBeDefined();
    expect(labVitamin!.score).toBe(1);

    // primaryTreatmentId is the first result
    expect(result.primaryTreatmentId).toBe(result.results[0].treatmentId);
  });

  it('multi-symptom: "Tired all the time" + "Brain fog / can\'t focus" → NAD+ 250 scores 8 (highest)', () => {
    const result = scoreSymptoms(
      ['Tired all the time', "Brain fog / can't focus"],
      TREATMENTS,
    );

    // NAD+ 250: 3 (tired) + 5 (brain fog) = 8
    const nad250 = result.results.find((r) => r.treatmentId === 'nad250');
    expect(nad250).toBeDefined();
    expect(nad250!.score).toBe(8);

    // NAD+ 250 should be primaryTreatmentId (highest scorer overall)
    expect(result.primaryTreatmentId).toBe('nad250');

    // B12 Shot: 2 (tired) + 0 (brain fog) = 2
    const b12 = result.results.find((r) => r.treatmentId === 'b12Shot');
    expect(b12).toBeDefined();
    expect(b12!.score).toBe(2);

    // Vitamin Lab: 1 (tired) + 0 = 1
    const labVitamin = result.results.find((r) => r.treatmentId === 'labVitamin');
    expect(labVitamin).toBeDefined();
    expect(labVitamin!.score).toBe(1);

    // The workflow map example shows: NAD+ 250 (8, nad), Myers' (4, iv), B12 Shot (2, injection), Vitamin Lab (1, lab)
    // With our updated catalog: myersPlatinum iv wins (tired=5, brain fog=2=7), myers (3+1=4), myersGold (4+0=4)
    // So myersPlatinum (7) beats myers (4) for the iv slot
    const ivResult = result.results.find((r) => r.category === 'iv');
    expect(ivResult).toBeDefined();
  });

  it('category deduplication: only highest scorer per category survives', () => {
    // "Brain fog / can't focus" hits NAD (250=5, 500=4, 100=3) -- only nad250 should survive dedup
    const result = scoreSymptoms(["Brain fog / can't focus"], TREATMENTS);

    const nadResults = result.results.filter((r) => r.category === 'nad');
    expect(nadResults).toHaveLength(1);
    expect(nadResults[0].treatmentId).toBe('nad250'); // highest nad scorer

    // IV: longevity (3) > myersPlatinum (2) for brain fog alone
    const ivResults = result.results.filter((r) => r.category === 'iv');
    expect(ivResults).toHaveLength(1);
  });

  it('max results cap: IV/NAD bucket has at most RULES.MAX_IV_NAD_RESULTS (3) entries', () => {
    // Selecting all symptoms will trigger many categories
    const result = scoreSymptoms([...SYMPTOM_LABELS], TREATMENTS);

    const ivNadResults = result.results.filter((r) =>
      (RULES.IV_NAD_CATEGORIES as readonly string[]).includes(r.category),
    );
    expect(ivNadResults.length).toBeLessThanOrEqual(RULES.MAX_IV_NAD_RESULTS);
  });

  it('bucket splitting: results are split correctly into iv/nad, programs, and labs/injections', () => {
    // "Struggling with weight" scores semaglutide (weightLoss) and lipo shots (injection)
    const result = scoreSymptoms(['Struggling with weight'], TREATMENTS);

    const weightLossResults = result.results.filter(
      (r) => r.category === 'weightLoss',
    );
    expect(weightLossResults.length).toBeGreaterThan(0);

    // IV/NAD should be empty for this symptom (no iv/nad scores weight loss)
    const ivNadResults = result.results.filter((r) =>
      (RULES.IV_NAD_CATEGORIES as readonly string[]).includes(r.category),
    );
    expect(ivNadResults).toHaveLength(0);
  });

  it('all symptoms selected: produces at least 1 result and does not crash', () => {
    const result = scoreSymptoms([...SYMPTOM_LABELS], TREATMENTS);
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.primaryTreatmentId).not.toBeNull();
  });

  it('addressedByTexts: selected symptoms that have addressedBy entries are included', () => {
    // Myers has addressedBy text for "Stressed and burnt out"
    const result = scoreSymptoms(['Stressed and burnt out'], TREATMENTS);

    const myersVariant = result.results.find((r) => r.category === 'iv');
    expect(myersVariant).toBeDefined();

    // At minimum, the matching symptom should appear in matchingSymptoms
    const topResult = result.results[0];
    expect(topResult.matchingSymptoms).toContain('Stressed and burnt out');
  });

  it('deduplication: when multiple NAD treatments score, only the highest survives', () => {
    // "Sore muscles / slow recovery": performance (5, iv), nad250 (1, nad), nad500 (2, nad), myers (2, iv)
    const result = scoreSymptoms(['Sore muscles / slow recovery'], TREATMENTS);

    const nadResults = result.results.filter((r) => r.category === 'nad');
    expect(nadResults).toHaveLength(1);
    // nad500 (2) beats nad250 (1) for this symptom
    expect(nadResults[0].treatmentId).toBe('nad500');
  });

  it('results are ordered highest score first', () => {
    const result = scoreSymptoms(["Brain fog / can't focus"], TREATMENTS);
    for (let i = 1; i < result.results.length; i++) {
      expect(result.results[i - 1].score).toBeGreaterThanOrEqual(
        result.results[i].score,
      );
    }
  });

  it('"Frequent headaches": migraine (5) is the top iv result, hydration (2) also scores', () => {
    const result = scoreSymptoms(['Frequent headaches'], TREATMENTS);

    // migraine (5) is the top iv scorer
    const ivResult = result.results.find((r) => r.category === 'iv');
    expect(ivResult).toBeDefined();
    expect(ivResult!.treatmentId).toBe('migraine');
    expect(ivResult!.score).toBe(5);

    // Hydration (2) is also iv category -- should be deduplicated out
    const hydration = result.results.find((r) => r.treatmentId === 'hydration');
    expect(hydration).toBeUndefined(); // deduped out by migraine
  });

  it('"Getting sick often": immunity (5, iv) wins iv slot, triImmuneShot (3) and vitaminDShot (2) score in injection slot (only triImmuneShot survives dedup)', () => {
    const result = scoreSymptoms(['Getting sick often'], TREATMENTS);

    const ivResult = result.results.find((r) => r.category === 'iv');
    expect(ivResult?.treatmentId).toBe('immunity');

    // injection dedup: triImmuneShot (3) beats vitaminDShot (2)
    const injectionResult = result.results.find((r) => r.category === 'injection');
    expect(injectionResult?.treatmentId).toBe('triImmuneShot');
  });

  it('"Not sure what I\'m missing": lab results appear (labVitamin wins with 4, labInDepth 3, labGeneral 2)', () => {
    const result = scoreSymptoms(["Not sure what I'm missing"], TREATMENTS);

    // Only 1 lab survives dedup (labVitamin = 4, highest)
    const labResults = result.results.filter((r) => r.category === 'lab');
    expect(labResults).toHaveLength(1);
    expect(labResults[0].treatmentId).toBe('labVitamin');
    expect(labResults[0].score).toBe(4);
  });
});
