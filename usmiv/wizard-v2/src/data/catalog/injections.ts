import type { Treatment } from '../../types/treatment';

export const lipoShots = {
  id: 'lipoShots',
  name: 'Lipo-Mino Injections',
  price: 35,
  priceLabel: '$35/shot',
  duration: '5 min',
  category: 'injection',
  acuityTypeId: 72157177,
  acuityDropdownValue: 'General Wellness',
  pageUrl: '/wizard-of-iv/treatments/?slug=lipoShots',
  shortDesc: 'Lipotropic fat-metabolism injections to support your weight loss program.',
  ingredients: [
    { name: 'MIC Complex (Methionine, Inositol, Choline)', benefit: 'Liver fat processing and fat mobilization' },
    { name: 'B12', benefit: 'Energy metabolism' },
  ],
  bestFor: ['Active weight loss programs', 'Metabolic support', 'Energy during dieting'],
  whyMatch:
    'Lipotropic injections contain MIC (Methionine, Inositol, Choline) — three compounds that help your liver process and mobilize stored fat. Combined with B12 for energy, these work best taken 1-2x per week alongside a caloric deficit.',
  scoringWeights: {
    'Struggling with weight': 3,
  },
  addressedBy: {
    'Struggling with weight': 'Lipotropic injections accelerate fat metabolism',
  },
  addonSuggestions: ['b12Shot'],
} as const satisfies Treatment;

export const b12Shot = {
  id: 'b12Shot',
  name: 'B12 Injection',
  price: 35,
  priceLabel: '$35/shot',
  duration: '5 min',
  category: 'injection',
  acuityTypeId: 72157177,
  acuityDropdownValue: 'General Wellness',
  pageUrl: '/wizard-of-iv/treatments/?slug=b12Shot',
  shortDesc: 'Quick energy and metabolism boost with vitamin B12.',
  ingredients: [
    { name: 'B12 (Methylcobalamin)', benefit: 'Energy production, red blood cell formation, nerve function' },
  ],
  bestFor: ['Low energy', 'Vegans/vegetarians', 'B12 deficiency', 'Quick pick-me-up'],
  whyMatch:
    'B12 injections bypass digestion entirely — 100% bioavailable versus roughly 1-2% for oral supplements. If you\'re vegan, vegetarian, over 50, or have GI absorption issues, injections are the most reliable way to maintain levels.',
  scoringWeights: {
    'Tired all the time': 2,
  },
  addressedBy: {
    'Tired all the time': 'B12 deficiency is the #1 reversible cause of persistent fatigue',
  },
  addonSuggestions: ['glutathioneShot'],
} as const satisfies Treatment;

export const biotinShot = {
  id: 'biotinShot',
  name: 'Biotin Injection',
  price: 35,
  priceLabel: '$35/shot',
  duration: '5 min',
  category: 'injection',
  acuityTypeId: 72157177,
  acuityDropdownValue: 'General Wellness',
  pageUrl: '/wizard-of-iv/treatments/?slug=biotinShot',
  shortDesc: 'Support stronger hair, skin, and nails with biotin (B7).',
  ingredients: [
    { name: 'Biotin (B7)', benefit: 'Keratin production for hair, skin, and nail strength' },
  ],
  bestFor: ['Hair thinning', 'Brittle nails', 'Skin health', 'Beauty support'],
  whyMatch:
    'Biotin (B7) is the key nutrient for keratin production — the structural protein in hair, skin, and nails. Oral biotin has limited absorption. The injection form delivers directly for stronger, faster results.',
  scoringWeights: {
    'Skin looks dull or aging': 3,
  },
  addressedBy: {
    'Skin looks dull or aging': 'Biotin supports keratin production for healthier skin, hair, and nails',
  },
  addonSuggestions: ['glutathioneShot'],
} as const satisfies Treatment;

export const glutathioneShot = {
  id: 'glutathioneShot',
  name: 'Glutathione Injection',
  price: 35,
  priceLabel: '$35/shot',
  duration: '5 min',
  category: 'injection',
  acuityTypeId: 72157177,
  acuityDropdownValue: 'General Wellness',
  pageUrl: '/wizard-of-iv/treatments/?slug=glutathioneShot',
  shortDesc: 'The body\'s master antioxidant for detox and skin brightening.',
  ingredients: [
    { name: 'Glutathione', benefit: 'Detoxification, skin brightening, immune support' },
  ],
  bestFor: ['Detox support', 'Skin brightening', 'Antioxidant protection'],
  whyMatch:
    'Glutathione is your body\'s master antioxidant and primary detox molecule. Oral glutathione is poorly absorbed — injection delivers it directly to your tissues where it neutralizes free radicals and supports liver function.',
  scoringWeights: {
    'Skin looks dull or aging': 4,
  },
  addressedBy: {
    'Skin looks dull or aging': 'Glutathione is the master antioxidant for skin brightening',
  },
  addonSuggestions: ['biotinShot'],
} as const satisfies Treatment;

export const triImmuneShot = {
  id: 'triImmuneShot',
  name: 'Tri-Immune Injection',
  price: 35,
  priceLabel: '$35/shot',
  duration: '5 min',
  category: 'injection',
  acuityTypeId: 72157177,
  acuityDropdownValue: 'General Wellness',
  pageUrl: '/wizard-of-iv/treatments/?slug=triImmuneShot',
  shortDesc: 'Triple immune defense with Vitamin C, Zinc, and Glutathione in one shot.',
  ingredients: [
    { name: 'Vitamin C',   benefit: 'Immune cell activation and antioxidant protection' },
    { name: 'Zinc',        benefit: 'Reduces cold duration, supports immune cell function' },
    { name: 'Glutathione', benefit: 'Cellular detox and immune modulation' },
  ],
  bestFor: ['Immune boost', 'Cold/flu season', 'Quick immune defense'],
  whyMatch:
    'Three proven immune compounds in one quick shot: Vitamin C activates white blood cells, Zinc regulates inflammatory response, and Glutathione provides antioxidant protection. Best taken at the first sign of illness or before travel.',
  scoringWeights: {
    'Getting sick often': 3,
  },
  addressedBy: {
    'Getting sick often': 'Concentrated triple-immune shot for rapid defense',
  },
  addonSuggestions: ['vitaminDShot'],
} as const satisfies Treatment;

export const vitaminDShot = {
  id: 'vitaminDShot',
  name: 'Vitamin D Injection',
  price: 35,
  priceLabel: '$35/shot',
  duration: '5 min',
  category: 'injection',
  acuityTypeId: 72157177,
  acuityDropdownValue: 'General Wellness',
  pageUrl: '/wizard-of-iv/treatments/?slug=vitaminDShot',
  shortDesc: 'High-dose vitamin D for bone health, immunity, and mood support.',
  ingredients: [
    { name: 'Vitamin D3', benefit: 'Bone health, immune regulation, mood support' },
  ],
  bestFor: ['Vitamin D deficiency', 'Low sun exposure', 'Bone health', 'Mood support'],
  whyMatch:
    'Most adults in Colorado are deficient. A single Vitamin D injection loads your stores immediately — no waiting weeks for oral supplements to build up. Supports immune regulation, bone density, and mood.',
  scoringWeights: {
    'Getting sick often': 2,
  },
  addressedBy: {
    'Getting sick often': 'Vitamin D deficiency is directly linked to immune weakness',
  },
  addonSuggestions: ['triImmuneShot'],
} as const satisfies Treatment;

export const INJECTION_TREATMENTS = [
  lipoShots,
  b12Shot,
  biotinShot,
  glutathioneShot,
  triImmuneShot,
  vitaminDShot,
] as const;
