/**
 * PDF generation helper — wraps @react-pdf/renderer's pdf() async API.
 *
 * Returns a Blob that can be downloaded, attached to an email, or previewed in an iframe.
 * Caller is responsible for cleanup (URL.revokeObjectURL).
 *
 * This is the ONLY place that runs compute() with a TraceContext. The trace is what
 * populates the appendix pages in the PDF. The on-screen ValueTicker calls compute()
 * without the trace and pays nothing for it.
 */

import { pdf } from '@react-pdf/renderer';
import { ValuationReport } from '../components/pdf/ValuationReport';
import { compute, type EngineInputs } from '../engine';
import { READINESS_QUESTIONS, RISK_QUESTIONS } from '../data/questions';

export interface PdfPayload {
  firmName: string;
  city?: string;
  inputs: EngineInputs;
  includeWealthGap: boolean;
  contact?: {
    matt?: { name: string; email: string; calendly?: string };
  };
}

export async function generateValuationPdf(payload: PdfPayload): Promise<Blob> {
  const outputs = compute(payload.inputs, {
    readinessQuestionDefs: READINESS_QUESTIONS,
    riskQuestionDefs: RISK_QUESTIONS,
    financialsInput: payload.inputs.financials,
    wealthGapInput: payload.includeWealthGap ? payload.inputs.wealthGap : undefined,
    multipleConfigInput: payload.inputs.multipleConfig,
    accelerationConfigInput: payload.inputs.acceleration,
  });

  const instance = pdf(
    <ValuationReport
      firmName={payload.firmName}
      city={payload.city}
      outputs={outputs}
      includeWealthGap={payload.includeWealthGap}
      contact={payload.contact}
    />,
  );
  return await instance.toBlob();
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const idx = result.indexOf(',');
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
