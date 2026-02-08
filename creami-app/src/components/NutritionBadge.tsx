interface NutritionBadgeProps {
  label: string;
  value: number | null;
  unit: string;
  highlight?: boolean;
}

export default function NutritionBadge({ label, value, unit, highlight }: NutritionBadgeProps) {
  if (value === null || value === undefined) return null;

  return (
    <div
      className={`flex flex-col items-center p-2 rounded-lg ${
        highlight ? 'bg-indigo-50 ring-1 ring-indigo-200' : 'bg-slate-50'
      }`}
    >
      <span className="text-lg font-bold text-slate-900">
        {typeof value === 'number' ? (Number.isInteger(value) ? value : value.toFixed(1)) : value}
      </span>
      <span className="text-[10px] text-slate-500 uppercase tracking-wider">{unit}</span>
      <span className="text-xs text-slate-600 font-medium">{label}</span>
    </div>
  );
}

interface NutritionBarProps {
  nutrition: {
    kcal: number;
    fat: number;
    carbs: number;
    sugar: number;
    protein: number;
    salt: number;
  };
  fpdf?: number | null;
  proteinRatio?: number | null;
  compact?: boolean;
}

export function NutritionBar({ nutrition, fpdf, proteinRatio, compact }: NutritionBarProps) {
  if (!nutrition) return null;

  const items = compact
    ? [
        { label: 'Kcal', value: nutrition.kcal, unit: '/100g' },
        { label: 'Protein', value: nutrition.protein, unit: 'g' },
        { label: 'FPDF', value: fpdf ?? null, unit: 'score' },
      ]
    : [
        { label: 'Kcal', value: nutrition.kcal, unit: '/100g', highlight: true },
        { label: 'Fat', value: nutrition.fat, unit: 'g' },
        { label: 'Carbs', value: nutrition.carbs, unit: 'g' },
        { label: 'Sugar', value: nutrition.sugar, unit: 'g' },
        { label: 'Protein', value: nutrition.protein, unit: 'g', highlight: true },
        { label: 'Salt', value: nutrition.salt, unit: 'g' },
        { label: 'FPDF', value: fpdf ?? null, unit: 'score', highlight: !!fpdf },
        { label: 'P/E Ratio', value: proteinRatio ?? null, unit: '%' },
      ];

  return (
    <div className={`grid ${compact ? 'grid-cols-3' : 'grid-cols-4 sm:grid-cols-8'} gap-2`}>
      {items.map((item) => (
        <NutritionBadge key={item.label} {...item} />
      ))}
    </div>
  );
}
