import type { Treatment } from '../../types/treatment';

export const nad100 = {
  id: 'nad100',
  name: 'NAD+ IV (100mg)',
  price: 100,
  duration: '60-90 min',
  category: 'nad',
  acuityTypeId: 43274230,
  acuityDropdownValue: 'General Wellness',
  pageUrl: '/wizard-of-iv/treatments/?slug=nad100',
  shortDesc: 'Entry-level NAD+ therapy for energy and mental clarity.',
  ingredients: [
    { name: 'NAD+ (100mg)', benefit: 'Cellular energy, DNA repair, cognitive clarity' },
  ],
  bestFor: ['First-time NAD+ users', 'Mild brain fog', 'Energy boost'],
  whyMatch:
    'NAD+ is a coenzyme found in every cell. At 100mg, this is a gentle introduction — expect improved energy, sharper focus, and mental clarity that builds over 24-48 hours. Ideal for first-timers or as a maintenance dose.',
  scoringWeights: {
    'Tired all the time':      2,
    'Brain fog / can\'t focus': 3,
  },
  addressedBy: {
    'Tired all the time':      'NAD+ restores cellular energy at the mitochondrial level',
    'Brain fog / can\'t focus': 'NAD+ is the coenzyme your neurons need for sustained energy',
  },
  // Gap fix: nad100 had no addon suggestions
  addonSuggestions: ['b12Shot'],
} as const satisfies Treatment;

export const nad250 = {
  id: 'nad250',
  name: 'NAD+ IV (250mg)',
  price: 250,
  duration: '60-90 min',
  category: 'nad',
  acuityTypeId: 43274230,
  acuityDropdownValue: 'General Wellness',
  pageUrl: '/wizard-of-iv/treatments/?slug=nad250',
  shortDesc: 'Mid-range NAD+ therapy for sustained energy and anti-aging benefits.',
  ingredients: [
    { name: 'NAD+ (250mg)', benefit: 'Enhanced cellular repair, sirtuin activation, anti-aging' },
  ],
  bestFor: ['Chronic fatigue', 'Anti-aging', 'Brain fog', 'Athletic recovery'],
  whyMatch:
    'NAD+ is a coenzyme in every cell of your body. At 250mg, this infusion restores cellular energy production and clears brain fog from the inside out.',
  scoringWeights: {
    'Tired all the time':         3,
    'Sore muscles / slow recovery': 1,
    'Brain fog / can\'t focus':   5,
    'Stressed and burnt out':     3,
  },
  addressedBy: {
    'Tired all the time':           'NAD+ restores the mitochondrial energy your cells need',
    'Sore muscles / slow recovery': 'NAD+ supports mitochondrial energy production in muscle cells for faster recovery',
    'Brain fog / can\'t focus':     'NAD+ is the coenzyme your neurons need for sustained energy',
    'Stressed and burnt out':       'Burnout depletes NAD+ — this replenishes it at the cellular level',
  },
  // nad250 auto-bundles with labVitamin (nadPlusLabs bundle)
  addonSuggestions: ['b12Shot', 'glutathioneShot'],
} as const satisfies Treatment;

export const nad500 = {
  id: 'nad500',
  name: 'NAD+ IV (500mg)',
  price: 400,
  duration: '60-90 min',
  category: 'nad',
  acuityTypeId: 43274230,
  acuityDropdownValue: 'General Wellness',
  pageUrl: '/wizard-of-iv/treatments/?slug=nad500',
  shortDesc: 'High-dose NAD+ for deep cellular restoration and longevity.',
  ingredients: [
    { name: 'NAD+ (500mg)', benefit: 'Deep cellular repair, addiction recovery support, longevity' },
  ],
  bestFor: ['Serious anti-aging', 'Addiction recovery', 'Chronic conditions', 'Longevity focus'],
  whyMatch:
    'At 500mg, NAD+ therapy reaches deep cellular restoration. This dose is particularly beneficial for longevity protocols, supporting addiction recovery, and rebuilding mitochondrial function after chronic stress or illness.',
  scoringWeights: {
    'Sore muscles / slow recovery': 2,
    'Brain fog / can\'t focus':     4,
  },
  addressedBy: {
    'Sore muscles / slow recovery': 'High-dose NAD+ delivers deep mitochondrial restoration for comprehensive muscle repair',
    'Brain fog / can\'t focus':     'High-dose NAD+ for deep cognitive restoration',
  },
  // Gap fix: nad500 had no addon suggestions
  addonSuggestions: ['glutathioneShot'],
} as const satisfies Treatment;

export const NAD_TREATMENTS = [nad100, nad250, nad500] as const;
