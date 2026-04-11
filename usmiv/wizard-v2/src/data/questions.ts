import type { Question, SingleQuestion, MultiQuestion } from '../types/question';

export const start: SingleQuestion = {
  id: 'start',
  type: 'single',
  title: 'What brings you in today?',
  subtitle: "We'll help you find the right treatment in under a minute.",
  options: [
    {
      label: 'I need relief right now',
      sublabel: 'Hangover, migraine, illness, dehydration',
      icon: 'bolt',
      next: 'acute',
    },
    {
      label: 'I want to improve my wellness',
      sublabel: 'Energy, beauty, immunity, performance',
      icon: 'heart',
      next: 'wellness',
    },
    {
      label: 'I want to lose weight',
      sublabel: 'GLP-1 programs, metabolism support',
      icon: 'scale',
      next: 'weightLoss',
    },
    {
      label: 'I need blood work done',
      sublabel: 'At-home lab panels and testing',
      icon: 'vial',
      next: 'labs',
    },
    {
      label: 'I just want a quick injection',
      sublabel: 'B12, Biotin, Glutathione, and more -- $35 each',
      icon: 'zap',
      next: 'quickShot',
    },
    {
      label: "I'm not sure -- help me decide",
      sublabel: "Tell us your symptoms and we'll match you",
      icon: 'help',
      next: 'symptoms',
    },
  ],
};

export const acute: SingleQuestion = {
  id: 'acute',
  type: 'single',
  title: "What's going on?",
  subtitle: 'Select what best describes your situation.',
  options: [
    { label: 'Hangover / drank too much',     icon: 'glass',   recommend: 'hangover' },
    { label: 'Migraine or severe headache',   icon: 'head',    recommend: 'migraine' },
    { label: 'Getting sick / cold or flu',    icon: 'virus',   recommend: 'immunity' },
    { label: 'Dehydrated or exhausted',       icon: 'droplet', next: 'dehydratedOrTired' },
    { label: 'Altitude sickness',             icon: 'mountain', recommend: 'altitude' },
    { label: 'Jet lag / just traveled',       icon: 'plane',   recommend: 'jetLagMyers' },
    { label: 'Recovering from illness or burnout', icon: 'battery', recommend: 'revival' },
  ],
};

export const wellness: SingleQuestion = {
  id: 'wellness',
  type: 'single',
  title: "What's your wellness goal?",
  subtitle: 'Pick the one that matters most right now.',
  options: [
    {
      label: 'More energy / less brain fog',
      icon: 'zap',
      next: 'energy',
    },
    {
      label: 'Better skin, hair, and nails',
      icon: 'sparkle',
      recommend: 'beautyBundle',
    },
    {
      label: 'Athletic performance / recovery',
      icon: 'dumbbell',
      next: 'athleticGoal',
    },
    {
      label: 'Anti-aging / longevity',
      icon: 'hourglass',
      next: 'antiAging',
    },
    {
      label: 'General tune-up',
      icon: 'refresh',
      next: 'myersUpgrade',
    },
    {
      label: 'Immune system support',
      icon: 'shield',
      recommend: 'immunity',
    },
    {
      label: 'Recurring migraines / prevention',
      sublabel: 'Regular magnesium IV for chronic migraine management',
      icon: 'head',
      recommend: 'migraine',
    },
    {
      label: 'Addiction / withdrawal support',
      sublabel: 'NAD+ therapy supports neurological recovery',
      icon: 'heart',
      next: 'nadDose',
    },
    {
      label: 'Prenatal support',
      icon: 'baby',
      recommend: 'pregnancy',
    },
  ],
};

export const energy: SingleQuestion = {
  id: 'energy',
  type: 'single',
  title: 'How long have you been feeling this way?',
  subtitle: 'This helps us recommend the right intensity.',
  options: [
    {
      label: 'Just this week',
      sublabel: 'Probably just need a recharge',
      next: 'myersUpgrade',
    },
    {
      label: 'A few weeks or months',
      sublabel: 'NAD+ restores cellular energy',
      next: 'nadDose',
    },
    {
      label: 'A long time / months or years',
      sublabel: "Let's check your levels too",
      next: 'nadDose',
    },
  ],
};

export const dehydratedOrTired: SingleQuestion = {
  id: 'dehydratedOrTired',
  type: 'single',
  title: 'What best describes how you feel?',
  subtitle: 'This helps us recommend the right treatment.',
  options: [
    {
      label: 'Dehydrated -- not drinking enough, heat, vomiting',
      sublabel: 'Pure saline rehydration, $120',
      icon: 'droplet',
      recommend: 'hydration',
    },
    {
      label: 'Exhausted / run-down / depleted',
      sublabel: "Full vitamin IV to restore what's missing",
      icon: 'battery',
      next: 'myersUpgrade',
    },
  ],
};

export const athleticGoal: SingleQuestion = {
  id: 'athleticGoal',
  type: 'single',
  title: "What's your focus?",
  subtitle: 'Different goals benefit from different approaches.',
  options: [
    {
      label: 'Post-workout / competition recovery',
      sublabel: 'Amino acids, vitamins, and hydration. $295',
      icon: 'dumbbell',
      recommend: 'performance',
    },
    {
      label: 'Cellular energy and deep recovery',
      sublabel: 'NAD+ therapy targets recovery at the cellular level, from $100',
      icon: 'zap',
      next: 'nadDose',
    },
  ],
};

export const nadDose: SingleQuestion = {
  id: 'nadDose',
  type: 'single',
  title: 'Which NAD+ dose is right for you?',
  subtitle:
    'NAD+ is a natural coenzyme your cells use for energy. It depletes with age and stress. Higher doses deliver deeper repair.',
  options: [
    {
      label: '100mg -- Entry level',
      sublabel: 'First-timers, mild fatigue. 60-90 min, $100',
      icon: 'zap',
      recommend: 'nad100',
    },
    {
      label: '250mg -- Most popular',
      sublabel: 'Chronic fatigue, brain fog, anti-aging. 60-90 min, $250',
      icon: 'zap',
      recommend: 'nadPlusLabs',
    },
    {
      label: '500mg -- Deep restoration',
      sublabel: 'Longevity focus, serious repair. 90-120 min, $400',
      icon: 'zap',
      recommend: 'nad500',
    },
  ],
};

export const antiAging: SingleQuestion = {
  id: 'antiAging',
  type: 'single',
  title: "What's your approach to anti-aging?",
  subtitle: 'Both options support cellular health and longevity.',
  options: [
    {
      label: 'Longevity IV -- full vitamin stack + NAD+',
      sublabel:
        '$250. Full vitamin stack with 50mg NAD+. For higher NAD+ doses, choose the dedicated option below.',
      icon: 'heart',
      recommend: 'longevity',
    },
    {
      label: 'NAD+ IV -- focused cellular repair',
      sublabel:
        'From $100. Pure NAD+ at your chosen dose (100-500mg). Targets cellular energy and DNA repair directly.',
      icon: 'zap',
      next: 'nadDose',
    },
  ],
};

export const myersUpgrade: SingleQuestion = {
  id: 'myersUpgrade',
  type: 'single',
  title: "Which Myers' level fits you?",
  subtitle: 'Same proven vitamin IV formula -- higher doses for a stronger effect',
  options: [
    {
      label: "Standard Myers' -- $220",
      sublabel: 'The proven original. 6 key vitamins and minerals.',
      icon: 'refresh',
      recommend: 'myers',
    },
    {
      label: "Myers' Gold -- $275",
      sublabel: 'Double-dose vitamins for a deeper effect.',
      icon: 'star',
      recommend: 'myersGold',
    },
    {
      label: "Myers' Platinum -- $375",
      sublabel: 'Triple dose + NAD+ (50mg). Our strongest general wellness IV.',
      icon: 'star',
      recommend: 'myersPlatinum',
    },
    {
      label: "I'd rather try NAD+ therapy",
      sublabel:
        'Pure cellular energy restoration, from $100. NAD+ is a coenzyme your cells use for energy -- it depletes with age and stress.',
      icon: 'zap',
      next: 'nadDose',
    },
  ],
};

export const quickShot: SingleQuestion = {
  id: 'quickShot',
  type: 'single',
  title: 'Which injection do you need?',
  subtitle: 'In and out in under 5 minutes, at your door. $35 each.',
  options: [
    { label: 'B12 -- Energy and metabolism',     sublabel: '$35', icon: 'zap',     recommend: 'b12Shot' },
    { label: 'Glutathione -- Detox and glow',    sublabel: '$35', icon: 'sparkle', recommend: 'glutathioneShot' },
    { label: 'Tri-Immune -- Triple immune defense', sublabel: '$35', icon: 'shield', recommend: 'triImmuneShot' },
    { label: 'Vitamin D -- Bone, mood, immune',  sublabel: '$35', icon: 'star',    recommend: 'vitaminDShot' },
    { label: 'Biotin -- Hair, skin, nails',      sublabel: '$35', icon: 'sparkle', recommend: 'biotinShot' },
    { label: 'Lipo-Mino -- Fat metabolism',      sublabel: '$35', icon: 'scale',   recommend: 'lipoShots' },
  ],
};

export const weightLoss: SingleQuestion = {
  id: 'weightLoss',
  type: 'single',
  title: 'Where are you in your weight loss journey?',
  subtitle: 'We offer medical-grade weight loss programs.',
  options: [
    {
      label: 'Just starting -- I want medical support',
      sublabel: 'GLP-1 programs from $199/month',
      next: 'glp1Choice',
    },
    {
      label: 'Already on a program, need a boost',
      sublabel: 'Injections and IV support',
      next: 'weightLossBoost',
    },
    {
      label: 'I want to explore my options',
      sublabel: "We'll walk you through everything",
      next: 'glp1Compare',
    },
  ],
};

export const weightLossBoost: SingleQuestion = {
  id: 'weightLossBoost',
  type: 'single',
  title: 'What kind of support do you need?',
  subtitle: 'We can complement your weight loss program.',
  options: [
    {
      label: 'Lipo-Mino injections',
      sublabel: 'Fat metabolism support, $35/shot',
      icon: 'scale',
      recommend: 'lipoShots',
    },
    {
      label: 'Full IV for energy during weight loss',
      sublabel: 'Combat fatigue from caloric restriction',
      icon: 'heart',
      next: 'myersUpgrade',
    },
  ],
};

export const glp1Choice: SingleQuestion = {
  id: 'glp1Choice',
  type: 'single',
  title: 'Which GLP-1 program fits your goals?',
  subtitle: 'Both are weekly injections with medical supervision.',
  options: [
    {
      label: 'Semaglutide (Ozempic/Wegovy) -- from $199/mo',
      sublabel: 'Up to 15% weight loss. Established track record.',
      icon: 'scale',
      recommend: 'semaglutide',
    },
    {
      label: 'Tirzepatide (Mounjaro/Zepbound) -- from $399/mo',
      sublabel: 'Dual-action GLP-1 + GIP. Up to 20% weight loss.',
      icon: 'scale',
      recommend: 'tirzepatide',
    },
    {
      label: 'Help me choose',
      sublabel: "We'll walk you through both options",
      icon: 'help',
      next: 'glp1Compare',
    },
  ],
};

export const glp1Compare: SingleQuestion = {
  id: 'glp1Compare',
  type: 'single',
  title: 'Semaglutide vs. Tirzepatide',
  subtitle: 'Both are GLP-1 medications. The key difference is strength and cost.',
  options: [
    {
      label: 'Semaglutide -- the proven choice',
      sublabel:
        'From $199/mo. Average 15% body weight loss. Single-action GLP-1. Lower cost, strong clinical track record (Wegovy/Ozempic).',
      icon: 'scale',
      recommend: 'semaglutide',
    },
    {
      label: 'Tirzepatide -- maximum results',
      sublabel:
        'From $399/mo. Up to 20% body weight loss. Dual-action GLP-1 + GIP. Stronger appetite suppression, newer medication (Mounjaro/Zepbound).',
      icon: 'scale',
      recommend: 'tirzepatide',
    },
    {
      label: 'I\'d like to talk to someone first',
      sublabel: 'Call us at 303-406-4500 for a free consultation',
      icon: 'help',
      recommend: 'weightLossConsult',
    },
  ],
};

export const labs: SingleQuestion = {
  id: 'labs',
  type: 'single',
  title: 'What kind of blood work do you need?',
  subtitle: 'A licensed professional comes to you. Results in days.',
  options: [
    {
      label: 'Basic health check',
      sublabel: 'CBC, metabolic panel, cholesterol -- $175',
      recommend: 'labGeneral',
    },
    {
      label: 'Deeper health assessment',
      sublabel: 'Adds thyroid and blood sugar -- $199',
      recommend: 'labInDepth',
    },
    {
      label: 'Check my vitamin levels',
      sublabel: 'B12, D, iron, magnesium, and more -- $225',
      recommend: 'labVitamin',
    },
    {
      label: 'Full comprehensive panel',
      sublabel: '45+ biomarkers, hormones included -- $449',
      recommend: 'labComplete',
    },
  ],
};

export const symptoms: MultiQuestion = {
  id: 'symptoms',
  type: 'multi',
  title: 'What resonates with you?',
  subtitle: 'Select all that apply -- even just one. We\'ll find your best match.',
  options: [
    { label: 'Tired all the time',           icon: 'battery' },
    { label: 'Frequent headaches',           icon: 'head' },
    { label: 'Getting sick often',           icon: 'virus' },
    { label: 'Skin looks dull or aging',     icon: 'sparkle' },
    { label: 'Sore muscles / slow recovery', icon: 'dumbbell' },
    { label: 'Struggling with weight',       icon: 'scale' },
    { label: "Brain fog / can't focus",      icon: 'cloud' },
    { label: 'Dehydrated / dry all the time', icon: 'droplet' },
    { label: 'Stressed and burnt out',       icon: 'fire' },
    { label: "Not sure what I'm missing",    icon: 'vial' },
  ],
};

export const QUESTIONS_ARRAY: readonly Question[] = [
  start,
  acute,
  wellness,
  energy,
  dehydratedOrTired,
  athleticGoal,
  nadDose,
  antiAging,
  myersUpgrade,
  quickShot,
  weightLoss,
  weightLossBoost,
  glp1Choice,
  glp1Compare,
  labs,
  symptoms,
];
