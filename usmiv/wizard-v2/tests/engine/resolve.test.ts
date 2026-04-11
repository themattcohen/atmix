import { describe, it, expect } from 'vitest';
import { resolveRecommendation } from '../../src/engine/resolve';
import { TREATMENTS, BUNDLES } from '../../src/data/index';
import type { TreatmentId } from '../../src/types/treatment';
import type { BundleId } from '../../src/types/bundle';
import type { RecommendId } from '../../src/types/question';

// All 27 treatment IDs
const ALL_TREATMENT_IDS: TreatmentId[] = [
  'hydration', 'myers', 'immunity', 'pregnancy', 'altitude', 'hangover',
  'migraine', 'longevity', 'myersGold', 'performance', 'myersPlatinum', 'revival',
  'nad100', 'nad250', 'nad500',
  'semaglutide', 'tirzepatide',
  'lipoShots', 'b12Shot', 'biotinShot', 'glutathioneShot', 'triImmuneShot', 'vitaminDShot',
  'labGeneral', 'labInDepth', 'labVitamin', 'labComplete',
];

// All 4 bundle IDs
const ALL_BUNDLE_IDS: BundleId[] = [
  'beautyBundle', 'nadPlusLabs', 'weightLossConsult', 'jetLagMyers',
];

describe('resolveRecommendation', () => {
  it('resolves a direct treatment: "hangover" → kind treatment, treatment.id === hangover', () => {
    const result = resolveRecommendation('hangover', TREATMENTS, BUNDLES);
    expect(result.kind).toBe('treatment');
    if (result.kind === 'treatment') {
      expect(result.treatment.id).toBe('hangover');
      expect(result.treatment.name).toBe('Hangover IV');
    }
  });

  it('resolves a bundle: "beautyBundle" → kind bundle, primary is myers, addOn is biotinShot', () => {
    const result = resolveRecommendation('beautyBundle', TREATMENTS, BUNDLES);
    expect(result.kind).toBe('bundle');
    if (result.kind === 'bundle') {
      expect(result.bundle.id).toBe('beautyBundle');
      expect(result.primary.id).toBe('myers');
      expect(result.addOn).not.toBeNull();
      expect(result.addOn?.id).toBe('biotinShot');
    }
  });

  it('resolves nadPlusLabs bundle → primary is nad250, addOn is labVitamin', () => {
    const result = resolveRecommendation('nadPlusLabs', TREATMENTS, BUNDLES);
    expect(result.kind).toBe('bundle');
    if (result.kind === 'bundle') {
      expect(result.bundle.id).toBe('nadPlusLabs');
      expect(result.primary.id).toBe('nad250');
      expect(result.addOn?.id).toBe('labVitamin');
    }
  });

  it('resolves weightLossConsult bundle → primary is semaglutide, addOn is null', () => {
    const result = resolveRecommendation('weightLossConsult', TREATMENTS, BUNDLES);
    expect(result.kind).toBe('bundle');
    if (result.kind === 'bundle') {
      expect(result.bundle.id).toBe('weightLossConsult');
      expect(result.primary.id).toBe('semaglutide');
      expect(result.addOn).toBeNull();
    }
  });

  it('resolves jetLagMyers bundle → primary is myers, no addOn', () => {
    const result = resolveRecommendation('jetLagMyers', TREATMENTS, BUNDLES);
    expect(result.kind).toBe('bundle');
    if (result.kind === 'bundle') {
      expect(result.primary.id).toBe('myers');
      expect(result.addOn).toBeNull();
    }
  });

  it('unknown ID throws Error (NOT silent fallback)', () => {
    expect(() =>
      resolveRecommendation('nonexistent' as RecommendId, TREATMENTS, BUNDLES),
    ).toThrow('Unknown recommendation ID: nonexistent');
  });

  it('all 27 treatment IDs resolve without throwing', () => {
    for (const tid of ALL_TREATMENT_IDS) {
      expect(() =>
        resolveRecommendation(tid, TREATMENTS, BUNDLES),
      ).not.toThrow();

      const result = resolveRecommendation(tid, TREATMENTS, BUNDLES);
      expect(result.kind).toBe('treatment');
    }
  });

  it('all 4 bundle IDs resolve without throwing', () => {
    for (const bid of ALL_BUNDLE_IDS) {
      expect(() =>
        resolveRecommendation(bid, TREATMENTS, BUNDLES),
      ).not.toThrow();

      const result = resolveRecommendation(bid, TREATMENTS, BUNDLES);
      expect(result.kind).toBe('bundle');
    }
  });

  it('each treatment result has correct kind and id matches the requested id', () => {
    for (const tid of ALL_TREATMENT_IDS) {
      const result = resolveRecommendation(tid, TREATMENTS, BUNDLES);
      expect(result.kind).toBe('treatment');
      if (result.kind === 'treatment') {
        expect(result.treatment.id).toBe(tid);
      }
    }
  });

  it('each bundle result has correct kind and id matches the requested id', () => {
    for (const bid of ALL_BUNDLE_IDS) {
      const result = resolveRecommendation(bid, TREATMENTS, BUNDLES);
      expect(result.kind).toBe('bundle');
      if (result.kind === 'bundle') {
        expect(result.bundle.id).toBe(bid);
        // primary treatment should be present in TREATMENTS
        expect(TREATMENTS[result.primary.id]).toBeDefined();
      }
    }
  });

  it('bundles resolve addOn to null when bundle has no addOn field', () => {
    // weightLossConsult and jetLagMyers have no addOn
    const consult = resolveRecommendation('weightLossConsult', TREATMENTS, BUNDLES);
    const jetLag = resolveRecommendation('jetLagMyers', TREATMENTS, BUNDLES);

    if (consult.kind === 'bundle') expect(consult.addOn).toBeNull();
    if (jetLag.kind === 'bundle') expect(jetLag.addOn).toBeNull();
  });
});
