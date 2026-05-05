import type { Treatment } from '../../types/treatment';

export const labGeneral = {
  id: 'labGeneral',
  name: 'General Wellness Panel',
  price: 175,
  duration: '15 min draw',
  category: 'lab',
  acuityTypeId: 55698420,
  acuityDropdownValue: null,
  pageUrl: '/treatments/labGeneral/',
  shortDesc: 'Essential blood work covering your core health markers.',
  ingredients: [
    { name: 'CBC (Complete Blood Count)', benefit: 'Red/white cells, hemoglobin, platelets — screens for anemia and infection' },
    { name: 'CMP (Comprehensive Metabolic Panel)', benefit: 'Kidney, liver, blood sugar, electrolytes — 14 core markers' },
    { name: 'Lipid Panel', benefit: 'Total cholesterol, LDL, HDL, triglycerides — cardiovascular risk' },
  ],
  tests: ['CBC', 'CMP', 'Lipid Panel'],
  bestFor: ['Annual check-up', 'Baseline health snapshot'],
  whyMatch:
    'A quick at-home blood draw covering your essential health markers. CBC checks your blood cells, CMP assesses organ function, and the Lipid Panel evaluates cardiovascular risk. Results in 2-5 business days.',
  scoringWeights: {
    'Not sure what I\'m missing': 2,
  },
  addressedBy: {
    'Not sure what I\'m missing': 'Essential baseline markers to identify common health issues',
  },
  // Gap fix: all labs had no addon suggestions
  addonSuggestions: ['b12Shot', 'vitaminDShot'],
} as const satisfies Treatment;

export const labInDepth = {
  id: 'labInDepth',
  name: 'In-Depth Wellness Panel',
  price: 199,
  duration: '15 min draw',
  category: 'lab',
  acuityTypeId: 55698420,
  acuityDropdownValue: null,
  pageUrl: '/treatments/labInDepth/',
  shortDesc: 'Deeper health assessment including thyroid and blood sugar markers.',
  ingredients: [
    { name: 'CBC',          benefit: 'Blood cell health and anemia screen' },
    { name: 'CMP',          benefit: 'Organ function and metabolic baseline' },
    { name: 'Lipid Panel',  benefit: 'Cholesterol and cardiovascular risk' },
    { name: 'TSH (Thyroid)', benefit: 'Thyroid function — fatigue, metabolism, mood' },
    { name: 'HbA1c',        benefit: '3-month blood sugar average — diabetes risk screening' },
  ],
  tests: ['CBC', 'CMP', 'Lipid Panel', 'TSH', 'HbA1c'],
  bestFor: ['Thyroid concerns', 'Blood sugar monitoring', 'Comprehensive health check'],
  whyMatch:
    'Goes deeper than the basics with thyroid (TSH) and blood sugar (HbA1c) markers. TSH screens for thyroid issues — a common cause of unexplained fatigue and weight changes. HbA1c shows your 3-month blood sugar average.',
  scoringWeights: {
    'Not sure what I\'m missing': 3,
  },
  addressedBy: {
    'Not sure what I\'m missing': 'Comprehensive baseline including thyroid and blood sugar',
  },
  // Gap fix: all labs had no addon suggestions
  addonSuggestions: ['b12Shot', 'vitaminDShot'],
} as const satisfies Treatment;

export const labVitamin = {
  id: 'labVitamin',
  name: 'Vitamin Level Panel',
  price: 225,
  duration: '15 min draw',
  category: 'lab',
  acuityTypeId: 55698420,
  acuityDropdownValue: null,
  pageUrl: '/treatments/labVitamin/',
  shortDesc: 'Check your vitamin and mineral levels to target exactly what your body needs.',
  ingredients: [
    { name: 'CBC + CMP',   benefit: 'Core health baseline' },
    { name: 'B12',         benefit: 'Energy, nerve health, mood — common deficiency' },
    { name: 'Folate',      benefit: 'Cell growth and anemia prevention' },
    { name: 'Vitamin D',   benefit: 'Bone health, immune regulation, mood' },
    { name: 'Potassium',   benefit: 'Heart rhythm and muscle function' },
    { name: 'Iron',        benefit: 'Energy transport — key for fatigue investigation' },
    { name: 'Magnesium',   benefit: 'Sleep, muscle, 300+ enzyme reactions' },
  ],
  tests: ['CBC', 'CMP', 'B12', 'Folate', 'Vitamin D', 'Potassium', 'Iron', 'Magnesium'],
  bestFor: ['Fatigue investigation', 'Nutrient deficiency check', 'Before starting IV therapy'],
  whyMatch:
    'Checks the specific vitamins and minerals that drive energy and wellness. If you\'ve been tired, foggy, or just not feeling right, this panel tells you exactly what your body is low on — so you can target your IV and injection choices.',
  scoringWeights: {
    'Tired all the time':      1,
    'Not sure what I\'m missing': 4,
  },
  addressedBy: {
    'Tired all the time':         'Find out if low B12, iron, or vitamin D is the root cause of your fatigue',
    'Not sure what I\'m missing': 'Find out exactly which vitamins and minerals you\'re low on',
  },
  // Gap fix: all labs had no addon suggestions
  addonSuggestions: ['b12Shot', 'vitaminDShot'],
} as const satisfies Treatment;

export const labComplete = {
  id: 'labComplete',
  name: 'Complete Wellness Panel',
  price: 449,
  duration: '15 min draw',
  category: 'lab',
  acuityTypeId: 55698420,
  acuityDropdownValue: null,
  pageUrl: '/treatments/labComplete/',
  shortDesc: 'Our most comprehensive panel with 45+ biomarkers for a full health picture.',
  ingredients: [
    { name: 'Full baseline (CBC + CMP + Lipid + TSH + HbA1c)', benefit: 'Complete metabolic and thyroid picture' },
    { name: 'Testosterone / Estradiol', benefit: 'Hormone balance, libido, body composition' },
    { name: 'Cortisol',     benefit: 'Stress response and adrenal function' },
    { name: 'Insulin',      benefit: 'Metabolic health and insulin resistance' },
    { name: 'ApoB',         benefit: 'Best single predictor of cardiovascular risk' },
    { name: 'Homocysteine', benefit: 'Inflammation and heart disease marker' },
    { name: 'PSA (males)',  benefit: 'Prostate health screening' },
    { name: 'Plus 20+ additional biomarkers', benefit: 'Comprehensive longevity and metabolic panel' },
  ],
  tests: [
    'CBC', 'CMP', 'Lipid Panel', 'TSH', 'HbA1c',
    'Testosterone/Estradiol', 'Cortisol', 'Insulin', 'ApoB',
    'Homocysteine', 'PSA', 'and more',
  ],
  bestFor: ['Full health assessment', 'Longevity optimization', 'Hormone concerns'],
  whyMatch:
    'Our most comprehensive panel with 45+ biomarkers including hormones (testosterone, estradiol, cortisol), insulin, ApoB (best cardiovascular predictor), and more. This is the full picture for anyone serious about optimizing their health.',
  scoringWeights: {},
  addressedBy: {},
  // Gap fix: all labs had no addon suggestions
  addonSuggestions: ['b12Shot', 'vitaminDShot'],
} as const satisfies Treatment;

export const LAB_TREATMENTS = [labGeneral, labInDepth, labVitamin, labComplete] as const;
