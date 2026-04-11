import { describe, it, expect } from 'vitest';
import { validateConfig } from '../../src/engine/validateConfig';
import { TREATMENTS, BUNDLES, QUESTIONS } from '../../src/data/index';
import type { Question, SingleQuestion } from '../../src/types/question';
import type { Treatment } from '../../src/types/treatment';

describe('validateConfig', () => {
  it('current config is valid: isValid === true, zero errors', () => {
    const result = validateConfig(TREATMENTS, QUESTIONS, BUNDLES);
    if (!result.isValid) {
      console.error('Validation errors:', result.errors);
    }
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('broken recommend: question option with non-existent recommend ID → error', () => {
    // Inject a fake question with a broken recommend reference
    const brokenQuestion: SingleQuestion = {
      id: 'start',
      type: 'single',
      title: 'Test',
      options: [
        { label: 'Option 1', recommend: 'nonexistentTreatment' as never },
      ],
    };
    const fakeQuestions = {
      ...QUESTIONS,
      start: brokenQuestion,
    };

    const result = validateConfig(TREATMENTS, fakeQuestions as typeof QUESTIONS, BUNDLES);
    expect(result.isValid).toBe(false);
    const recommendError = result.errors.find(
      (e) => e.field === 'recommend' && e.message.includes('nonexistentTreatment'),
    );
    expect(recommendError).toBeDefined();
  });

  it('broken next: question option with non-existent next question ID → error', () => {
    const brokenQuestion: SingleQuestion = {
      id: 'start',
      type: 'single',
      title: 'Test',
      options: [
        { label: 'Option 1', next: 'nonexistentQuestion' as never },
      ],
    };
    const fakeQuestions = {
      ...QUESTIONS,
      start: brokenQuestion,
    };

    const result = validateConfig(TREATMENTS, fakeQuestions as typeof QUESTIONS, BUNDLES);
    expect(result.isValid).toBe(false);
    const nextError = result.errors.find(
      (e) => e.field === 'next' && e.message.includes('nonexistentQuestion'),
    );
    expect(nextError).toBeDefined();
  });

  it('unreachable treatment: treatment with no scoring weights and not in any question path → warning', () => {
    // Create a treatment that has no scoring weights and is not referenced by any question
    const orphanTreatment: Treatment = {
      id: 'labComplete', // use existing id slot but override to make unreachable
      name: 'Orphan Treatment',
      price: 100,
      duration: '30 min',
      category: 'iv',
      acuityTypeId: 12345,
      acuityDropdownValue: null,
      pageUrl: '/test',
      shortDesc: 'Test',
      ingredients: [],
      bestFor: [],
      whyMatch: 'test',
      scoringWeights: {}, // no scoring weights
      addressedBy: {},
      addonSuggestions: [],
    };

    // Build a treatment set where labComplete is replaced with the orphan
    // labComplete is only reachable via the labs question, so it IS reachable
    // We need to add a NEW treatment ID that nothing references
    // Instead, test with a modified TREATMENTS that removes all references by
    // using a fresh treatments record with an extra unreachable treatment

    // Patch: replace a question that normally points to labComplete to not point to it
    const labsQuestion: SingleQuestion = {
      id: 'labs',
      type: 'single',
      title: 'Test labs',
      options: [
        { label: 'Only option', recommend: 'labGeneral' }, // no longer recommends labComplete
      ],
    };
    const modifiedQuestions = { ...QUESTIONS, labs: labsQuestion };

    // Add orphan as labComplete -- no question references it, no scoring weights
    const modifiedTreatments = { ...TREATMENTS, labComplete: orphanTreatment };

    const result = validateConfig(
      modifiedTreatments,
      modifiedQuestions as typeof QUESTIONS,
      BUNDLES,
    );

    const unreachableWarning = result.warnings.find(
      (w) => w.subject === 'treatment:labComplete' && w.field === 'reachability',
    );
    expect(unreachableWarning).toBeDefined();
  });

  it('empty whyMatch → warning', () => {
    const treatmentWithEmptyWhyMatch: Treatment = {
      ...TREATMENTS.hangover,
      whyMatch: '   ', // whitespace only -- treated as empty
    };
    const modifiedTreatments = { ...TREATMENTS, hangover: treatmentWithEmptyWhyMatch };

    const result = validateConfig(modifiedTreatments, QUESTIONS, BUNDLES);
    const whyMatchWarning = result.warnings.find(
      (w) => w.subject === 'treatment:hangover' && w.field === 'whyMatch',
    );
    expect(whyMatchWarning).toBeDefined();
  });

  it('all treatments are reachable with the real config: no unreachable warnings', () => {
    const result = validateConfig(TREATMENTS, QUESTIONS, BUNDLES);

    const unreachableWarnings = result.warnings.filter(
      (w) => w.field === 'reachability',
    );
    // With our data gap fixes, all treatments should be reachable
    if (unreachableWarnings.length > 0) {
      console.warn('Unreachable treatment warnings:', unreachableWarnings);
    }
    expect(unreachableWarnings).toHaveLength(0);
  });

  it('broken addonSuggestions reference → error', () => {
    const treatmentWithBadAddon: Treatment = {
      ...TREATMENTS.myers,
      addonSuggestions: ['nonexistentAddon' as never],
    };
    const modifiedTreatments = { ...TREATMENTS, myers: treatmentWithBadAddon };

    const result = validateConfig(modifiedTreatments, QUESTIONS, BUNDLES);
    expect(result.isValid).toBe(false);
    const addonError = result.errors.find(
      (e) =>
        e.subject === 'treatment:myers' &&
        e.field === 'addonSuggestions' &&
        e.message.includes('nonexistentAddon'),
    );
    expect(addonError).toBeDefined();
  });

  it('acuityTypeId === 0 on a treatment → error', () => {
    const treatmentWithNoAcuity: Treatment = {
      ...TREATMENTS.hydration,
      acuityTypeId: 0,
    };
    const modifiedTreatments = { ...TREATMENTS, hydration: treatmentWithNoAcuity };

    const result = validateConfig(modifiedTreatments, QUESTIONS, BUNDLES);
    expect(result.isValid).toBe(false);
    const acuityError = result.errors.find(
      (e) => e.subject === 'treatment:hydration' && e.field === 'acuityTypeId',
    );
    expect(acuityError).toBeDefined();
  });

  it('orphan scoringWeight key (typo in symptom label) → error', () => {
    const treatmentWithTypo: Treatment = {
      ...TREATMENTS.myers,
      scoringWeights: {
        ...TREATMENTS.myers.scoringWeights,
        'Typo symptom label': 3, // not a valid symptom label
      },
    };
    const modifiedTreatments = { ...TREATMENTS, myers: treatmentWithTypo };

    const result = validateConfig(modifiedTreatments, QUESTIONS, BUNDLES);
    expect(result.isValid).toBe(false);
    const orphanError = result.errors.find(
      (e) =>
        e.subject === 'treatment:myers' &&
        e.field.includes('Typo symptom label'),
    );
    expect(orphanError).toBeDefined();
  });
});
