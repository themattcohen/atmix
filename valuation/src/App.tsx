import { useEffect, useState } from 'react';
import { READINESS_QUESTIONS, RISK_QUESTIONS } from './data/questions';
import { Button } from './components/ui/Button';
import { StepNav } from './components/wizard/StepNav';
import { ValueTicker } from './components/wizard/ValueTicker';
import { FirmProfileStep } from './components/steps/FirmProfileStep';
import { FinancialsStep } from './components/steps/FinancialsStep';
import { QuestionStep } from './components/steps/QuestionStep';
import { ResultsStep } from './components/steps/ResultsStep';
import { useWizard, TOTAL_STEPS, buildEngineInputs } from './state/useWizard';
import { fmt } from './lib/format';
// Lazy-load PDF code — saves ~490KB gzipped from initial bundle

export function App() {
  const w = useWizard();
  const [pdfBusy, setPdfBusy] = useState(false);

  const onEmailReport = async () => {
    setPdfBusy(true);
    try {
      const { generateValuationPdf, downloadBlob } = await import('./lib/pdf');
      const blob = await generateValuationPdf({
        firmName: w.state.firmName,
        city: w.state.city,
        inputs: buildEngineInputs(w.state),
        includeWealthGap: w.state.showWealthGap,
        contact: {
          matt: { name: 'Matt Cohen', email: 'hello@somedayconsultants.com' },
        },
      });
      const slug = (w.state.firmName.trim() || 'firm')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      downloadBlob(blob, `${slug}-valuation-${new Date().toISOString().slice(0, 10)}.pdf`);
      console.log('[pdf] generated', blob.size, 'bytes');
    } catch (e) {
      console.error('[pdf] generation failed', e);
      alert(`PDF generation failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setPdfBusy(false);
    }
  };

  // Keyboard nav — Matt drives the call without a mouse
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement) {
        const tag = e.target.tagName;
        if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      }
      if (e.key === 'ArrowRight') w.next();
      if (e.key === 'ArrowLeft') w.back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [w]);

  const hasFinancials = w.state.financials.revenue > 0;

  return (
    <div className="min-h-screen bg-someday-cream-light text-someday-slate flex flex-col">
      {/* Header */}
      <header className="border-b hairline bg-someday-cream-light no-print">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="font-display text-2xl font-semibold text-someday-forest leading-none">
            Someday Consultants
            <span className="block text-[10px] font-body font-semibold uppercase tracking-[0.18em] text-someday-slate-mid mt-1">
              Sell-Side M&amp;A Advisory
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden md:inline text-xs text-someday-slate-muted">
              {fmt.mtDate()}
            </span>
            <Button variant="ghost" size="md" onClick={w.loadDemo}>
              Load demo
            </Button>
            <Button variant="ghost" size="md" onClick={w.reset}>
              Reset
            </Button>
          </div>
        </div>
      </header>

      <div className="no-print">
        <StepNav current={w.step} onJump={w.goTo} />
      </div>

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-10 grid lg:grid-cols-[1fr_320px] gap-10">
        <div>
          {w.step === 0 && (
            <FirmProfileStep
              firmName={w.state.firmName}
              city={w.state.city}
              onChange={(patch) => {
                if (patch.firmName !== undefined) w.update('firmName', patch.firmName);
                if (patch.city !== undefined) w.update('city', patch.city);
              }}
            />
          )}
          {w.step === 1 && (
            <FinancialsStep financials={w.state.financials} onChange={w.updateFinancials} />
          )}
          {w.step === 2 && (
            <QuestionStep
              stepNumber={3}
              totalSteps={TOTAL_STEPS}
              title="How ready are you to sell?"
              intro="Seven questions about timing, alignment, and what comes after. None of this changes the math directly — but it tells me which kind of buyer to bring to the table."
              questions={READINESS_QUESTIONS}
              answers={w.state.readinessAnswers}
              onChange={w.updateReadiness}
            />
          )}
          {w.step === 3 && (
            <QuestionStep
              stepNumber={4}
              totalSteps={TOTAL_STEPS}
              title="What does the firm look like to a buyer?"
              intro="Sixteen questions covering the things buyers actually diligence: client concentration, revenue mix, key-person risk, financial hygiene. Each one moves your sellability grade up or down."
              questions={RISK_QUESTIONS}
              answers={w.state.riskAnswers}
              onChange={w.updateRisk}
            />
          )}
          {w.step === 4 && (
            <ResultsStep
              firmName={w.state.firmName}
              inputs={buildEngineInputs(w.state)}
              outputs={w.outputs}
              showWealthGap={w.state.showWealthGap}
              onToggleWealthGap={(v) => w.update('showWealthGap', v)}
              wealthGapInputs={w.state.wealthGap}
              onChangeWealthGap={w.updateWealthGap}
              onEmailReport={onEmailReport}
              isEmailing={pdfBusy}
            />
          )}

          {/* Footer nav buttons */}
          <div className="mt-10 pt-6 border-t hairline flex items-center justify-between no-print">
            <Button variant="secondary" size="md" onClick={w.back} disabled={w.step === 0}>
              Back
            </Button>
            <p className="text-xs text-someday-slate-muted hidden md:block">
              Use ← → keys to navigate
            </p>
            {w.step < TOTAL_STEPS - 1 ? (
              <Button variant="primary" size="md" onClick={w.next}>
                Next
              </Button>
            ) : (
              <Button variant="ghost" size="md" onClick={w.reset}>
                Start over
              </Button>
            )}
          </div>
        </div>

        <div className="no-print">
          <ValueTicker outputs={w.outputs} hasFinancials={hasFinancials} />
        </div>
      </main>

      <footer className="border-t hairline bg-someday-cream-light no-print">
        <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-sm text-someday-slate-muted">
          <p>Internal sales tool · Preview only</p>
          <p>hello@somedayconsultants.com</p>
        </div>
      </footer>
    </div>
  );
}
