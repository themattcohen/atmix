import { Input } from '../ui/Input';
import { SectionLabel } from '../ui/Card';

interface Props {
  firmName: string;
  city: string;
  onChange: (patch: { firmName?: string; city?: string }) => void;
}

export function FirmProfileStep({ firmName, city, onChange }: Props) {
  return (
    <div>
      <SectionLabel className="mb-3">Step 1 of 5</SectionLabel>
      <h2 className="font-display text-display-lg mb-3">Tell me about your firm.</h2>
      <p className="text-someday-slate-mid mb-8">
        Two questions to anchor the conversation. Everything else is on the next screens.
      </p>

      <div className="space-y-5 max-w-xl">
        <Input
          label="Firm name"
          value={firmName}
          onChange={(e) => onChange({ firmName: e.target.value })}
          placeholder="e.g. Smith & Partners CPA"
          autoFocus
        />
        <Input
          label="City / Metro"
          value={city}
          onChange={(e) => onChange({ city: e.target.value })}
          placeholder="e.g. Denver, CO"
          helperText="We use this for benchmarking against regional CPA M&A comps."
        />
      </div>
    </div>
  );
}
