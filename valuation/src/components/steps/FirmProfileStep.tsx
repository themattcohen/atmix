import { Input } from '../ui/Input';
import { SectionLabel } from '../ui/Card';

interface Props {
  firmName: string;
  city: string;
  ownerEmail: string;
  onChange: (patch: { firmName?: string; city?: string; ownerEmail?: string }) => void;
}

export function FirmProfileStep({ firmName, city, ownerEmail, onChange }: Props) {
  return (
    <div>
      <SectionLabel className="mb-3">Step 1 of 5</SectionLabel>
      <h2 className="font-display text-display-lg mb-3">Tell me about your firm.</h2>
      <p className="text-someday-slate-mid mb-8">
        A few questions to anchor the conversation. Everything else is on the next screens.
      </p>

      <div className="space-y-5 max-w-xl">
        <Input
          label="Your email"
          type="email"
          value={ownerEmail}
          onChange={(e) => onChange({ ownerEmail: e.target.value })}
          placeholder="you@yourfirm.com"
          required
          autoFocus
        />
        <Input
          label="Firm name"
          value={firmName}
          onChange={(e) => onChange({ firmName: e.target.value })}
          placeholder="e.g. Smith & Partners CPA"
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
