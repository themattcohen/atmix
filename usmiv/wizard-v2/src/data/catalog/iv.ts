import type { Treatment } from '../../types/treatment';

export const hydration = {
  id: 'hydration',
  name: 'Hydration IV',
  price: 120,
  duration: '30-45 min',
  category: 'iv',
  acuityTypeId: 43274230,
  acuityDropdownValue: 'Dehydration',
  pageUrl: '/treatments/hydration/',
  shortDesc: 'Pure saline rehydration to restore your body\'s fluid balance fast.',
  ingredients: [
    { name: 'Normal Saline (NS/LR)', benefit: 'Restores hydration and electrolyte balance' },
  ],
  bestFor: ['Dehydration', 'Post-workout', 'Heat exposure', 'General fatigue'],
  whyMatch:
    'Pure saline contains sodium and chloride in the same ratio as your blood plasma. IV delivery restores fluid balance within 20-30 minutes — significantly faster than drinking water, which takes 1-2 hours to absorb through the GI tract.',
  scoringWeights: {
    'Frequent headaches': 2,
    'Dehydrated / dry all the time': 5,
  },
  addressedBy: {
    'Frequent headaches': 'Dehydration is the most common headache trigger',
    'Dehydrated / dry all the time': 'Pure saline IV restores fluid balance within 30 minutes',
  },
  addonSuggestions: ['b12Shot'],
} as const satisfies Treatment;

export const myers = {
  id: 'myers',
  name: 'Myers\' Cocktail',
  price: 220,
  duration: '30-45 min',
  category: 'iv',
  acuityTypeId: 43274230,
  acuityDropdownValue: 'General Wellness',
  pageUrl: '/treatments/myers/',
  shortDesc: 'The gold standard vitamin IV for energy, immunity, and overall wellness.',
  ingredients: [
    { name: 'B12',         benefit: 'Energy and neurological support' },
    { name: 'B-Complex',   benefit: 'Cellular energy metabolism' },
    { name: 'Vitamin C',   benefit: 'Immune function and antioxidant protection' },
    { name: 'Magnesium',   benefit: 'Muscle relaxation and enzyme support' },
    { name: 'Glutathione', benefit: 'Master antioxidant and detox' },
    { name: 'Zinc',        benefit: 'Immune defense and healing' },
  ],
  bestFor: ['General wellness', 'Fatigue', 'Stress', 'Feeling run-down'],
  whyMatch:
    'The Myers\' Cocktail is the gold standard vitamin IV — a proven blend of B vitamins, Vitamin C, Magnesium, and Glutathione for overall energy and wellness.',
  scoringWeights: {
    'Tired all the time':         3,
    'Frequent headaches':         2,
    'Getting sick often':         2,
    'Skin looks dull or aging':   2,
    'Sore muscles / slow recovery': 2,
    'Brain fog / can\'t focus':   1,
    'Dehydrated / dry all the time': 3,
    'Stressed and burnt out':     3,
  },
  addressedBy: {
    'Tired all the time':       'The Myers\' B-vitamin stack replenishes cellular fuel',
    'Frequent headaches':       'B vitamins and Magnesium address nutrient deficiencies that trigger tension headaches',
    'Getting sick often':       'Vitamin C and Zinc support immune activation and reduce illness duration',
    'Skin looks dull or aging': 'Glutathione and Vitamin C support collagen synthesis and antioxidant protection',
    'Sore muscles / slow recovery': 'Magnesium and B vitamins reduce soreness and cramping',
    'Brain fog / can\'t focus': 'B vitamins and Magnesium restore neurotransmitter support for mental clarity',
    'Dehydrated / dry all the time': 'Full vitamin IV that also addresses dehydration',
    'Stressed and burnt out':   'The gold-standard stress and burnout reset',
  },
  addonSuggestions: ['b12Shot', 'glutathioneShot'],
} as const satisfies Treatment;

export const immunity = {
  id: 'immunity',
  name: 'Immunity IV',
  price: 220,
  duration: '30-45 min',
  category: 'iv',
  acuityTypeId: 43274230,
  acuityDropdownValue: 'Cold/Flu',
  pageUrl: '/treatments/immunity/',
  shortDesc: 'High-dose immune support to fight off illness or keep you protected.',
  ingredients: [
    { name: 'B12',        benefit: 'Energy for immune cell activity' },
    { name: 'Vitamin C',  benefit: 'Immune activation and antioxidant' },
    { name: 'Zinc',       benefit: 'Reduces cold duration by up to 33%' },
    { name: 'Glutathione', benefit: 'Cellular detox and protection' },
    { name: 'Vitamin D',  benefit: 'Immune regulation and bone health' },
  ],
  bestFor: ['Cold/flu onset', 'Seasonal illness prevention', 'Frequent travelers', 'Weakened immunity'],
  whyMatch:
    'This IV is most effective at the first sign of illness. High-dose Vitamin C activates white blood cell production. Zinc has been shown to reduce cold duration by up to 33% when started within 24 hours. Glutathione clears cellular damage before it compounds.',
  scoringWeights: {
    'Getting sick often': 5,
  },
  addressedBy: {
    'Getting sick often': 'High-dose Vitamin C, Zinc, and Glutathione activate your immune response',
  },
  addonSuggestions: ['triImmuneShot', 'vitaminDShot'],
} as const satisfies Treatment;

export const pregnancy = {
  id: 'pregnancy',
  name: 'Pregnancy / Prenatal IV',
  price: 220,
  duration: '30-45 min',
  category: 'iv',
  acuityTypeId: 43274230,
  acuityDropdownValue: 'General Wellness',
  pageUrl: '/treatments/pregnancy/',
  shortDesc: 'Safe prenatal hydration and nutrient support for mom and baby.',
  ingredients: [
    { name: 'B12',         benefit: 'Fetal neural development' },
    { name: 'B-Complex',   benefit: 'Energy and metabolism support' },
    { name: 'Vitamin C',   benefit: 'Immune and collagen support' },
    { name: 'Magnesium',   benefit: 'Reduces cramping and nausea' },
    { name: 'Glutathione', benefit: 'Antioxidant protection' },
    { name: 'Zinc',        benefit: 'Immune support and healing' },
  ],
  bestFor: ['Morning sickness', 'Prenatal fatigue', 'Dehydration during pregnancy'],
  whyMatch:
    'This IV is specifically formulated for pregnant patients. Magnesium helps reduce cramping and nausea. B12 supports fetal neural tube development. All ingredients are nurse-administered and pregnancy-safe. We recommend letting your OB provider know.',
  scoringWeights: {},
  addressedBy: {},
  addonSuggestions: ['b12Shot'],
} as const satisfies Treatment;

export const altitude = {
  id: 'altitude',
  name: 'Altitude Sickness IV',
  price: 250,
  duration: '30-45 min',
  category: 'iv',
  acuityTypeId: 43274230,
  acuityDropdownValue: 'Nausea',
  pageUrl: '/treatments/altitude/',
  shortDesc: 'Fast relief from Colorado\'s high elevation symptoms.',
  ingredients: [
    { name: 'B12',                    benefit: 'Energy and oxygen transport support' },
    { name: 'B-Complex',              benefit: 'Cellular energy production' },
    { name: 'Vitamin C',              benefit: 'Antioxidant protection' },
    { name: 'Magnesium',              benefit: 'Muscle and nerve function' },
    { name: 'Glutathione',            benefit: 'Oxidative stress reduction' },
    { name: 'Anti-Nausea Medication', benefit: 'Stops nausea and dizziness' },
  ],
  bestFor: ['Visitors to Colorado', 'Elevation headache', 'Nausea at altitude', 'Shortness of breath'],
  whyMatch:
    'Colorado\'s elevation hits hard — most visitors feel symptoms within 6-12 hours above 8,000 ft. This IV rapidly replaces the fluid your body loses at altitude while anti-nausea medication addresses the dizziness and headache directly.',
  scoringWeights: {
    'Dehydrated / dry all the time': 2,
  },
  addressedBy: {
    'Dehydrated / dry all the time': 'High-altitude air is extremely dry -- this IV replaces fluid your body loses faster at elevation',
  },
  addonSuggestions: ['b12Shot'],
} as const satisfies Treatment;

export const hangover = {
  id: 'hangover',
  name: 'Hangover IV',
  price: 250,
  duration: '30-45 min',
  category: 'iv',
  acuityTypeId: 43274230,
  acuityDropdownValue: 'Hangover',
  pageUrl: '/treatments/hangover/',
  shortDesc: 'Get back on your feet fast with rehydration, anti-nausea, and pain relief.',
  ingredients: [
    { name: 'B12',         benefit: 'Replenishes alcohol-depleted stores' },
    { name: 'B-Complex',   benefit: 'Energy metabolism recovery' },
    { name: 'Magnesium',   benefit: 'Headache and muscle relief' },
    { name: 'Glutathione', benefit: 'Liver detox support' },
    { name: 'Zofran',      benefit: 'Stops nausea fast' },
    { name: 'Toradol',     benefit: 'Powerful headache and pain relief' },
  ],
  bestFor: ['Post-drinking recovery', 'Nausea and vomiting', 'Pounding headache', 'Event recovery'],
  whyMatch:
    'Alcohol depletes B vitamins, causes significant dehydration, and triggers inflammation. Toradol (ketorolac) is a prescription-strength anti-inflammatory for your headache. Zofran stops nausea fast. Most patients feel 80-90% better before the bag is done.',
  scoringWeights: {},
  addressedBy: {},
  addonSuggestions: ['b12Shot'],
} as const satisfies Treatment;

export const migraine = {
  id: 'migraine',
  name: 'Migraine IV',
  price: 250,
  duration: '30-45 min',
  category: 'iv',
  acuityTypeId: 43274230,
  acuityDropdownValue: 'Migraine',
  pageUrl: '/treatments/migraine/',
  shortDesc: 'Targeted migraine relief with high-dose magnesium and pain medication.',
  ingredients: [
    { name: 'B-Complex',             benefit: 'Neurological support' },
    { name: 'B12 (double dose)',      benefit: 'Nerve function and energy' },
    { name: 'Magnesium (triple dose)', benefit: 'Blocks migraine pain pathways' },
    { name: 'Glutathione',           benefit: 'Reduces neuroinflammation' },
    { name: 'Taurine',               benefit: 'Neuroprotective support' },
    { name: 'Toradol',               benefit: 'Powerful anti-inflammatory pain relief' },
    { name: 'Zofran',                benefit: 'Stops migraine-related nausea' },
  ],
  bestFor: ['Active migraine attack', 'Chronic migraines', 'Severe headache with nausea', 'Light/sound sensitivity'],
  whyMatch:
    'Triple-dose Magnesium blocks NMDA receptors in pain signaling pathways — this is the same approach used in ER migraine protocols. Combined with Toradol (prescription anti-inflammatory) and Zofran (anti-nausea), this targets migraine from multiple angles simultaneously.',
  scoringWeights: {
    'Frequent headaches': 5,
  },
  addressedBy: {
    'Frequent headaches': 'Triple-dose Magnesium blocks migraine pain pathways',
  },
  addonSuggestions: ['vitaminDShot'],
} as const satisfies Treatment;

export const longevity = {
  id: 'longevity',
  name: 'Longevity IV',
  price: 250,
  duration: '30-45 min',
  category: 'iv',
  acuityTypeId: 43274230,
  acuityDropdownValue: 'General Wellness',
  pageUrl: '/treatments/longevity/',
  shortDesc: 'Anti-aging cellular support with NAD+ and a full vitamin stack.',
  ingredients: [
    { name: 'B12',          benefit: 'Energy and nerve health' },
    { name: 'B-Complex',    benefit: 'Cellular metabolism' },
    { name: 'Vitamin C',    benefit: 'Collagen and antioxidant' },
    { name: 'Magnesium',    benefit: '300+ enzyme reactions' },
    { name: 'Glutathione',  benefit: 'Master antioxidant' },
    { name: 'Zinc',         benefit: 'Immune and cellular repair' },
    { name: 'NAD+ (50mg)',  benefit: 'Cellular energy and DNA repair' },
  ],
  bestFor: ['Anti-aging', 'Cellular health', 'Long-term vitality', 'Biohacking'],
  whyMatch:
    'NAD+ activates sirtuins — the proteins responsible for DNA repair and cellular longevity. Combined with a full vitamin stack, this IV works at the cellular level. Most patients notice improved energy and mental clarity within 24 hours, with cumulative benefits over regular sessions.',
  scoringWeights: {
    'Skin looks dull or aging': 3,
    'Brain fog / can\'t focus': 3,
  },
  addressedBy: {
    'Skin looks dull or aging': 'Full antioxidant stack with NAD+ for cellular-level anti-aging',
    'Brain fog / can\'t focus': 'NAD+ 50mg + full vitamin stack for mental clarity',
  },
  addonSuggestions: ['glutathioneShot'],
} as const satisfies Treatment;

export const myersGold = {
  id: 'myersGold',
  name: 'Myers\' Gold',
  price: 275,
  duration: '30-45 min',
  category: 'iv',
  acuityTypeId: 43274230,
  acuityDropdownValue: 'General Wellness',
  pageUrl: '/treatments/myersGold/',
  shortDesc: 'An enhanced Myers\' Cocktail with upgraded vitamin concentrations.',
  ingredients: [
    { name: 'B12 (double dose)',       benefit: 'Elevated energy and neurological support' },
    { name: 'B-Complex (double dose)', benefit: 'Enhanced cellular energy metabolism' },
    { name: 'Vitamin C (high dose)',   benefit: 'Stronger immune activation and antioxidant effect' },
    { name: 'Magnesium (double dose)', benefit: 'Deep muscle relaxation and headache prevention' },
    { name: 'Glutathione',             benefit: 'Master antioxidant and liver detox' },
    { name: 'Zinc',                    benefit: 'Immune defense and cellular repair' },
    { name: 'Calcium Gluconate',       benefit: 'Bone density and neuromuscular function' },
  ],
  bestFor: ['Upgraded wellness experience', 'Those who want more than the standard Myers\''],
  whyMatch:
    'The Gold upgrade doubles the B12, B-Complex, and Magnesium concentrations. If you\'ve had a standard Myers\' before and want a stronger effect, or you\'re dealing with more than mild fatigue, this is the step up.',
  // Gap fix: add scoring weights (similar to myers but slightly higher)
  scoringWeights: {
    'Tired all the time':            4,
    'Frequent headaches':            2,
    'Getting sick often':            2,
    'Skin looks dull or aging':      2,
    'Sore muscles / slow recovery':  2,
    'Dehydrated / dry all the time': 2,
    'Stressed and burnt out':        4,
  },
  addressedBy: {
    'Tired all the time':         'Double-dose B12 and B-Complex deliver a stronger cellular energy boost than the standard Myers\'',
    'Frequent headaches':         'Double-dose Magnesium is a proven migraine and tension headache preventative',
    'Getting sick often':         'High-dose Vitamin C and Zinc provide stronger immune activation',
    'Skin looks dull or aging':   'Glutathione and Calcium Gluconate support skin health at elevated concentrations',
    'Sore muscles / slow recovery': 'Double-dose Magnesium and B-Complex accelerate muscle repair',
    'Dehydrated / dry all the time': 'Elevated saline base and double electrolytes address deeper dehydration',
    'Stressed and burnt out':     'Doubled vitamin concentrations provide a deeper reset for burnout and chronic stress',
  },
  addonSuggestions: ['b12Shot', 'glutathioneShot'],
} as const satisfies Treatment;

export const performance = {
  id: 'performance',
  name: 'Performance IV',
  price: 295,
  duration: '30-45 min',
  category: 'iv',
  acuityTypeId: 43274230,
  acuityDropdownValue: 'General Wellness',
  pageUrl: '/treatments/performance/',
  shortDesc: 'Fuel recovery and performance with amino acids, NAD+, and essential nutrients.',
  ingredients: [
    { name: 'B12',                    benefit: 'Energy metabolism' },
    { name: 'B-Complex',              benefit: 'Cellular energy' },
    { name: 'Magnesium',              benefit: 'Muscle function and recovery' },
    { name: 'Glutathione',            benefit: 'Neutralizes exercise-induced free radicals' },
    { name: 'Taurine',                benefit: 'Endurance and muscle support' },
    { name: 'NAD+',                   benefit: 'Cellular energy production' },
    { name: 'Amino Blend / Lipo-Mino', benefit: 'Muscle protein synthesis and fat metabolism' },
  ],
  bestFor: ['Athletes', 'Post-competition recovery', 'Training support', 'Muscle soreness'],
  whyMatch:
    'Amino acids drive muscle protein synthesis and recovery. NAD+ supports mitochondrial energy production. Taurine reduces exercise-induced oxidative stress. This combination is designed to help you recover faster and train harder — most effective within 2 hours post-workout.',
  scoringWeights: {
    'Sore muscles / slow recovery': 5,
  },
  addressedBy: {
    'Sore muscles / slow recovery': 'Amino acids, NAD+, and Taurine accelerate muscle repair',
  },
  addonSuggestions: ['lipoShots', 'b12Shot'],
} as const satisfies Treatment;

export const myersPlatinum = {
  id: 'myersPlatinum',
  name: 'Myers\' Platinum',
  price: 375,
  duration: '30-45 min',
  category: 'iv',
  acuityTypeId: 43274230,
  acuityDropdownValue: 'General Wellness',
  pageUrl: '/treatments/myersPlatinum/',
  shortDesc: 'The ultimate Myers\' experience with premium vitamin concentrations.',
  ingredients: [
    { name: 'B12 (triple dose)',       benefit: 'Maximum energy and nerve support' },
    { name: 'B-Complex (triple dose)', benefit: 'Peak cellular metabolism' },
    { name: 'Vitamin C (25g)',         benefit: 'High-dose immune activation' },
    { name: 'Magnesium (triple dose)', benefit: 'Maximum muscle, nerve, and enzyme support' },
    { name: 'Glutathione (high dose)', benefit: 'Aggressive cellular detox and skin brightening' },
    { name: 'Zinc',                    benefit: 'Immune defense and healing' },
    { name: 'Calcium Gluconate',       benefit: 'Bone and neuromuscular support' },
    { name: 'NAD+ (50mg)',             benefit: 'Cellular energy and DNA repair boost' },
  ],
  bestFor: ['Premium wellness seekers', 'Maximum nutrient delivery'],
  whyMatch:
    'Our maximum-dose Myers\': triple vitamin concentrations plus 50mg of NAD+ for cellular energy repair. This is our most potent general wellness IV — the closest thing to a full reset.',
  // Gap fix: add scoring weights (similar to myersGold but slightly higher)
  scoringWeights: {
    'Tired all the time':            5,
    'Frequent headaches':            3,
    'Getting sick often':            3,
    'Skin looks dull or aging':      3,
    'Sore muscles / slow recovery':  3,
    'Brain fog / can\'t focus':      2,
    'Dehydrated / dry all the time': 2,
    'Stressed and burnt out':        5,
  },
  addressedBy: {
    'Tired all the time':         'Triple-dose B12 and B-Complex plus NAD+ deliver maximum cellular energy restoration',
    'Frequent headaches':         'Triple-dose Magnesium exceeds ER migraine protocol concentrations',
    'Getting sick often':         'Maximum-dose Vitamin C and Zinc for peak immune activation',
    'Skin looks dull or aging':   'High-dose Glutathione with NAD+ delivers aggressive cellular anti-aging',
    'Sore muscles / slow recovery': 'Triple-dose Magnesium and B-Complex at maximum concentrations for full recovery',
    'Brain fog / can\'t focus':   'NAD+ 50mg combined with triple B-Complex for peak cognitive support',
    'Dehydrated / dry all the time': 'Triple vitamin concentration plus NAD+ addresses dehydration and cellular depletion',
    'Stressed and burnt out':     'Triple vitamin concentrations plus NAD+ — our strongest burnout reset',
  },
  addonSuggestions: ['glutathioneShot', 'b12Shot'],
} as const satisfies Treatment;

export const revival = {
  id: 'revival',
  name: 'Revival IV',
  price: 395,
  duration: '30-45 min',
  category: 'iv',
  acuityTypeId: 43274230,
  acuityDropdownValue: 'General Wellness',
  pageUrl: '/treatments/revival/',
  shortDesc: 'Our most comprehensive IV with a full vitamin stack plus your choice of 3 medications.',
  ingredients: [
    { name: 'B12',         benefit: 'Energy and neurological recovery' },
    { name: 'B-Complex',   benefit: 'Cellular energy metabolism' },
    { name: 'Vitamin C',   benefit: 'Immune support and antioxidant' },
    { name: 'Magnesium',   benefit: 'Muscle relaxation and headache relief' },
    { name: 'Glutathione', benefit: 'Liver detox and cellular repair' },
    { name: 'Zinc',        benefit: 'Immune defense' },
    {
      name: 'Your choice of 3 medications',
      benefit: 'Toradol, Zofran, Benadryl, Pepcid, or Reglan — discussed with your nurse',
    },
  ],
  bestFor: ['Severe illness recovery', 'Burnout', 'Chronic fatigue', 'Post-event recovery'],
  whyMatch:
    'Our most comprehensive IV. The full vitamin stack covers B12, B-Complex, Vitamin C, Magnesium, Glutathione, and Zinc. You then choose 3 medications from Toradol, Zofran, Benadryl, Pepcid, or Reglan — your nurse reviews all options with you before starting.',
  scoringWeights: {
    'Tired all the time':     2,
    'Stressed and burnt out': 3,
  },
  addressedBy: {
    'Tired all the time':     'Full vitamin stack restores what chronic fatigue depletes',
    'Stressed and burnt out': 'Our most comprehensive IV with your choice of 3 medications',
  },
  // Gap fix: revival had no addon suggestions
  addonSuggestions: ['b12Shot', 'glutathioneShot'],
} as const satisfies Treatment;

export const IV_TREATMENTS = [
  hydration,
  myers,
  immunity,
  pregnancy,
  altitude,
  hangover,
  migraine,
  longevity,
  myersGold,
  performance,
  myersPlatinum,
  revival,
] as const;
