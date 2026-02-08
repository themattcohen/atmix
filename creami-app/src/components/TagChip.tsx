interface TagChipProps {
  tag: string;
  selected?: boolean;
  onClick?: (tag: string) => void;
  size?: 'sm' | 'md';
}

const TAG_COLORS: Record<string, string> = {
  Vegan: 'bg-green-100 text-green-800 border-green-200',
  'Dairy-Free': 'bg-green-50 text-green-700 border-green-200',
  Fruit: 'bg-orange-100 text-orange-800 border-orange-200',
  'Hi-Protein': 'bg-blue-100 text-blue-800 border-blue-200',
  'Low-Sugar': 'bg-teal-100 text-teal-800 border-teal-200',
  'Low-Cal': 'bg-teal-50 text-teal-700 border-teal-200',
  'Low-Fat': 'bg-teal-50 text-teal-700 border-teal-200',
  Light: 'bg-sky-100 text-sky-800 border-sky-200',
  Scoopable: 'bg-purple-100 text-purple-800 border-purple-200',
  Favorite: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  Keto: 'bg-amber-100 text-amber-800 border-amber-200',
  Sorbet: 'bg-pink-100 text-pink-800 border-pink-200',
  Alcohol: 'bg-red-100 text-red-800 border-red-200',
  Draft: 'bg-gray-100 text-gray-600 border-gray-200',
  Coconut: 'bg-amber-50 text-amber-700 border-amber-200',
  Simple: 'bg-slate-100 text-slate-700 border-slate-200',
};

const DEFAULT_COLOR = 'bg-indigo-50 text-indigo-700 border-indigo-200';

export default function TagChip({ tag, selected, onClick, size = 'sm' }: TagChipProps) {
  const colorClass = selected
    ? 'bg-indigo-600 text-white border-indigo-600'
    : TAG_COLORS[tag] || DEFAULT_COLOR;

  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1';

  return (
    <button
      type="button"
      onClick={() => onClick?.(tag)}
      className={`inline-flex items-center rounded-full border font-medium transition-all hover:scale-105 ${colorClass} ${sizeClass} ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
    >
      {tag}
    </button>
  );
}
