import { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import type { EngineInputs, EngineOutput } from '../../engine';
import type { WizardState } from '../../state/useWizard';
import { blobToBase64 } from '../../lib/pdf';

interface Props {
  firmName: string;
  inputs: EngineInputs;
  outputs: EngineOutput;
  includeWealthGap: boolean;
  /** Pre-fills the email field from the step-1 ownerEmail captured in wizard state. */
  prefillEmail?: string;
  /** Full wizard state, sent to the worker so Matt gets complete answers. */
  wizardState?: WizardState;
}

type Status = 'idle' | 'generating' | 'sending' | 'sent' | 'error';

// Production endpoint: the someday-marketing Cloudflare Worker, which hosts the
// /api/valuation/submit handler on all 5 brand domains. somedayhq.com is the canonical one.
// Override via VITE_SUBMIT_URL for dev/staging.
const SUBMIT_URL =
  import.meta.env.VITE_SUBMIT_URL ??
  'https://somedayhq.com/api/valuation/submit';

export function EmailReportForm({ firmName, inputs, outputs, includeWealthGap, prefillEmail, wizardState }: Props) {
  const [open, setOpen] = useState(false);
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState(prefillEmail ?? '');
  const [website, setWebsite] = useState(''); // honeypot
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerName.trim() || !ownerEmail.trim()) {
      setErrorMsg('Name and email are required.');
      setStatus('error');
      return;
    }
    setErrorMsg(null);
    setStatus('generating');

    try {
      const { generateValuationPdf } = await import('../../lib/pdf');
      const blob = await generateValuationPdf({
        firmName,
        inputs,
        includeWealthGap,
        contact: { matt: { name: 'Matt Cohen', email: 'matt@somedayconsultants.com' } },
      });
      const pdfBase64 = await blobToBase64(blob);

      setStatus('sending');
      const resp = await fetch(SUBMIT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firmName,
          ownerName,
          ownerEmail,
          pdfBase64,
          website, // honeypot
          summary: {
            currentValue: outputs.acceleration.currentValue,
            blendedSalePrice: outputs.acceleration.blendedSalePrice,
            sellabilityGrade: outputs.sellability.grade,
          },
          wizardAnswers: wizardState ?? null,
        }),
      });
      const data = (await resp.json().catch(() => ({}))) as { ok?: boolean; message?: string };
      if (!resp.ok || !data.ok) {
        throw new Error(data.message || `Request failed (${resp.status})`);
      }
      setStatus('sent');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setStatus('error');
    }
  };

  if (status === 'sent') {
    return (
      <div className="card mt-4 border-someday-gold bg-someday-cream">
        <p className="font-display text-xl text-someday-forest">
          Sent. The PDF is on its way to <strong>{ownerEmail}</strong>.
        </p>
        <p className="text-someday-slate-mid text-sm mt-2">
          Check spam if it doesn't arrive in a few minutes. Matt is BCC'd on the email.
        </p>
      </div>
    );
  }

  if (!open) {
    return (
      <Button variant="primary" size="lg" onClick={() => setOpen(true)}>
        Email me the report
      </Button>
    );
  }

  const busy = status === 'generating' || status === 'sending';

  return (
    <form onSubmit={onSubmit} className="card mt-4 max-w-xl space-y-4">
      <p className="text-sm text-someday-slate-mid">
        I'll generate the PDF and email it to you. Matt is BCC'd so he can follow up if useful.
      </p>
      <Input
        label="Your name"
        value={ownerName}
        onChange={(e) => setOwnerName(e.target.value)}
        autoComplete="name"
        autoFocus
      />
      <Input
        label="Your email"
        type="email"
        value={ownerEmail}
        onChange={(e) => setOwnerEmail(e.target.value)}
        autoComplete="email"
        placeholder="you@yourfirm.com"
      />
      {/* Honeypot */}
      <div className="hidden" aria-hidden>
        <Input
          label="Website"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          tabIndex={-1}
        />
      </div>

      {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}

      <div className="flex items-center gap-3 pt-2">
        <Button variant="primary" size="md" type="submit" disabled={busy}>
          {status === 'generating' ? 'Building PDF…' : status === 'sending' ? 'Sending…' : 'Send'}
        </Button>
        <Button variant="ghost" size="md" type="button" onClick={() => setOpen(false)} disabled={busy}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
