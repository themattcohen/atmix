export function PageExplainer({ text }: { text: string }) {
  return (
    <p className="text-xs text-text-secondary leading-relaxed mb-4 max-w-2xl">{text}</p>
  );
}
