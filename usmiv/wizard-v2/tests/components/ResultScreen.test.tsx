import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ResultScreen } from '../../src/components/ResultScreen';
import type { ResolvedRecommendation } from '../../src/types/bundle';
import type { Treatment } from '../../src/types/treatment';
import type { WizardMeta } from '../../src/data/meta';
import type { WizardAction } from '../../src/types/state';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const hangoverTreatment: Treatment = {
  id: 'hangover',
  name: 'Hangover IV',
  price: 250,
  duration: '45-60 min',
  category: 'iv',
  acuityTypeId: 43274230,
  acuityDropdownValue: 'Hangover',
  pageUrl: '/wizard-of-iv/treatments/?slug=hangover',
  shortDesc: 'Fast-acting IV to eliminate nausea, headache, and dehydration.',
  ingredients: [
    { name: 'Normal Saline', benefit: 'Restores hydration' },
    { name: 'B-Complex',     benefit: 'Restores depleted B vitamins' },
    { name: 'Zofran',        benefit: 'Stops nausea fast' },
  ],
  bestFor: ['Hangover', 'Nausea', 'Headache', 'Dehydration'],
  whyMatch: 'Alcohol depletes B vitamins and causes dehydration. This IV restores both directly into your bloodstream.',
  scoringWeights: {},
  addressedBy: {},
  addonSuggestions: ['b12Shot'],
  note: undefined,
};

const simpleTreatment: Treatment = {
  id: 'hydration',
  name: 'Hydration IV',
  price: 120,
  duration: '30-45 min',
  category: 'iv',
  acuityTypeId: 43274230,
  acuityDropdownValue: 'Dehydration',
  pageUrl: '/wizard-of-iv/treatments/?slug=hydration',
  shortDesc: 'Pure saline rehydration.',
  ingredients: [
    { name: 'Normal Saline', benefit: 'Restores hydration and electrolyte balance' },
  ],
  bestFor: ['Dehydration', 'Post-workout'],
  whyMatch: 'Pure saline restores fluid balance quickly.',
  scoringWeights: {},
  addressedBy: {},
  addonSuggestions: [],
};

const testMeta: WizardMeta = {
  acuityBaseUrl: 'https://example.as.me',
  acuityAvailabilityUrl: '',  // empty = direct link booking (no inline flow)
  phoneNumber: '303-406-4500',
  reviewCount: '546',
};

const treatmentRecommendation: ResolvedRecommendation = {
  kind: 'treatment',
  treatment: hangoverTreatment,
};

const treatmentRecommendationNoAddons: ResolvedRecommendation = {
  kind: 'treatment',
  treatment: simpleTreatment,
};

function makeProps(
  recommendation: ResolvedRecommendation = treatmentRecommendation,
  dispatch = vi.fn<[WizardAction], void>(),
) {
  return {
    recommendation,
    bundleAddonAdded: false,
    sessionPlan: [],
    meta: testMeta,
    dispatch,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ResultScreen', () => {
  it('renders the treatment name', () => {
    render(<ResultScreen {...makeProps()} />);
    expect(screen.getByText('Hangover IV')).toBeInTheDocument();
  });

  it('renders the treatment price', () => {
    render(<ResultScreen {...makeProps()} />);
    expect(screen.getByText('$250')).toBeInTheDocument();
  });

  it('renders the whyMatch explanation', () => {
    render(<ResultScreen {...makeProps()} />);
    expect(
      screen.getByText(/Alcohol depletes B vitamins/)
    ).toBeInTheDocument();
  });

  it('renders at least one ingredient name', () => {
    render(<ResultScreen {...makeProps()} />);
    expect(screen.getByText('Normal Saline')).toBeInTheDocument();
    expect(screen.getByText('B-Complex')).toBeInTheDocument();
    expect(screen.getByText('Zofran')).toBeInTheDocument();
  });

  it('renders bestFor tags', () => {
    render(<ResultScreen {...makeProps()} />);
    expect(screen.getByText('Hangover')).toBeInTheDocument();
    expect(screen.getByText('Nausea')).toBeInTheDocument();
  });

  it('renders addon chip section when treatment has addonSuggestions', () => {
    render(<ResultScreen {...makeProps(treatmentRecommendation)} />);
    // hangoverTreatment has addonSuggestions: ['b12Shot']
    expect(screen.getByText('Suggested add-ons')).toBeInTheDocument();
  });

  it('does not render addon section when treatment has no addonSuggestions', () => {
    render(<ResultScreen {...makeProps(treatmentRecommendationNoAddons)} />);
    expect(screen.queryByText('Suggested add-ons')).not.toBeInTheDocument();
  });

  it('renders the TrustBar with review count', () => {
    render(<ResultScreen {...makeProps()} />);
    expect(screen.getByText(/546/)).toBeInTheDocument();
  });

  it('renders a booking CTA button', () => {
    render(<ResultScreen {...makeProps()} />);
    // acuityAvailabilityUrl is empty so it renders an <a> link
    expect(screen.getByRole('link', { name: /book this treatment/i })).toBeInTheDocument();
  });

  it('renders the back button', () => {
    render(<ResultScreen {...makeProps()} />);
    expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument();
  });

  it('dispatches GO_BACK when back button is clicked', () => {
    const dispatch = vi.fn();
    render(<ResultScreen {...makeProps(treatmentRecommendation, dispatch)} />);
    fireEvent.click(screen.getByRole('button', { name: /go back/i }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'GO_BACK' });
  });

  it('renders the start over button', () => {
    render(<ResultScreen {...makeProps()} />);
    expect(screen.getByRole('button', { name: /restart/i })).toBeInTheDocument();
  });

  it('dispatches RESET when start over is clicked', () => {
    const dispatch = vi.fn();
    render(<ResultScreen {...makeProps(treatmentRecommendation, dispatch)} />);
    fireEvent.click(screen.getByRole('button', { name: /restart/i }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'RESET' });
  });

  it('renders the match label heading', () => {
    render(<ResultScreen {...makeProps()} />);
    expect(screen.getByText('Your recommended treatment')).toBeInTheDocument();
  });

  it('renders treatment duration', () => {
    render(<ResultScreen {...makeProps()} />);
    expect(screen.getByText('45-60 min')).toBeInTheDocument();
  });

  it('renders a Learn More link when pageUrl is set', () => {
    render(<ResultScreen {...makeProps()} />);
    // hangoverTreatment.pageUrl is set
    expect(screen.getByRole('link', { name: /learn more/i })).toBeInTheDocument();
  });
});
