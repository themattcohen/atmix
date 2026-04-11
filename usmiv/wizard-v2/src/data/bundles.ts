import type { Bundle } from '../types/bundle';

export const beautyBundle = {
  id: 'beautyBundle',
  name: 'Beauty Glow Package',
  primary: 'myers',
  addOn: 'biotinShot',
  addOnLabel: 'Add a Biotin shot for hair, skin, and nails (+$35)',
  addOnInteractive: true,
  isConsultation: false,
  whyMatch:
    "A Myers' Cocktail with Glutathione gives your skin an antioxidant glow, plus Biotin supports keratin production for stronger hair and nails.",
  acuityTypeId: 43274230,
  acuityDropdownValue: 'General Wellness',
} as const satisfies Bundle;

export const nadPlusLabs = {
  id: 'nadPlusLabs',
  name: 'NAD+ IV + Vitamin Level Panel',
  primary: 'nad250',
  addOn: 'labVitamin',
  addOnLabel: 'Add a Vitamin Level Panel to check what you\'re low on ($225)',
  addOnInteractive: true,
  isConsultation: false,
  whyMatch:
    'Long-term fatigue often has an underlying nutrient deficiency. NAD+ restores cellular energy while the lab panel reveals exactly what your body needs.',
  acuityTypeId: 43274230,
  acuityDropdownValue: 'General Wellness',
} as const satisfies Bundle;

export const weightLossConsult = {
  id: 'weightLossConsult',
  name: 'Weight Loss Consultation',
  primary: 'semaglutide',
  addOnInteractive: false,
  isConsultation: true,
  whyMatch:
    'Our weight loss programs include weekly GLP-1 medication, personalized dosing, and ongoing RN support. We\'ll help you find the right fit.',
  acuityTypeId: 47840203,
  acuityDropdownValue: null,
} as const satisfies Bundle;

export const jetLagMyers = {
  id: 'jetLagMyers',
  name: 'Myers\' Cocktail',
  primary: 'myers',
  addOnInteractive: false,
  isConsultation: false,
  whyMatch:
    "Jet lag disrupts your circadian rhythm and accelerates dehydration. A Myers' Cocktail rehydrates and delivers B vitamins that support melatonin production and nervous system reset. Best taken within 4 hours of landing or first thing the morning after arrival.",
  acuityTypeId: 43274230,
  acuityDropdownValue: 'General Wellness',
} as const satisfies Bundle;

export const BUNDLES_ARRAY = [beautyBundle, nadPlusLabs, weightLossConsult, jetLagMyers] as const;
