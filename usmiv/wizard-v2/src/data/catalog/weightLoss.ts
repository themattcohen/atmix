import type { Treatment } from '../../types/treatment';

export const semaglutide = {
  id: 'semaglutide',
  name: 'Semaglutide (GLP-1) Weight Loss',
  price: 199,
  priceLabel: 'from $199/month',
  duration: 'Ongoing program',
  category: 'weightLoss',
  acuityTypeId: 47840203,
  acuityDropdownValue: null,
  pageUrl: '/wizard-of-iv/treatments/?slug=semaglutide',
  shortDesc: 'FDA-studied GLP-1 medication for significant, sustained weight loss with medical supervision.',
  ingredients: [
    {
      name: 'Semaglutide',
      benefit: 'Suppresses appetite, slows gastric emptying, average 15% body weight loss',
    },
  ],
  bestFor: ['BMI 30+', 'BMI 27+ with health conditions', 'Sustained weight loss', 'Appetite control'],
  note: 'Requires initial bloodwork ($99) and medical consultation.',
  whyMatch:
    'Semaglutide is a GLP-1 medication clinically shown to reduce body weight by up to 15%. Our program includes weekly injections, personalized dosing, and ongoing RN support.',
  scoringWeights: {
    'Struggling with weight': 5,
  },
  addressedBy: {
    'Struggling with weight': 'GLP-1 medication with clinical evidence for 15% body weight reduction',
  },
  // Gap fix: semaglutide had no addon suggestions
  addonSuggestions: ['lipoShots', 'b12Shot'],
} as const satisfies Treatment;

export const tirzepatide = {
  id: 'tirzepatide',
  name: 'Tirzepatide (GLP-1+GIP) Weight Loss',
  price: 399,
  priceLabel: 'from $399/month',
  duration: 'Ongoing program',
  category: 'weightLoss',
  acuityTypeId: 47840203,
  acuityDropdownValue: null,
  pageUrl: '/wizard-of-iv/treatments/?slug=tirzepatide',
  shortDesc: 'Dual-action GLP-1/GIP medication for up to 20% body weight reduction.',
  ingredients: [
    {
      name: 'Tirzepatide',
      benefit: 'Dual hormone action for stronger appetite suppression and weight loss',
    },
  ],
  bestFor: ['BMI 30+', 'BMI 27+ with health conditions', 'Maximum weight loss', 'Dual-action medication'],
  note: 'Requires initial bloodwork ($99) and medical consultation.',
  whyMatch:
    'Tirzepatide works on two hormones (GLP-1 and GIP) for even stronger appetite suppression — clinical trials show up to 20% body weight reduction.',
  scoringWeights: {
    'Struggling with weight': 4,
  },
  addressedBy: {
    'Struggling with weight': 'Dual-action GLP-1+GIP for up to 20% weight loss',
  },
  // Gap fix: tirzepatide had no addon suggestions
  addonSuggestions: ['lipoShots', 'b12Shot'],
} as const satisfies Treatment;

export const WEIGHT_LOSS_TREATMENTS = [semaglutide, tirzepatide] as const;
