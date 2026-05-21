/**
 * PDF generation helper — wraps @react-pdf/renderer's pdf() async API.
 *
 * Returns a Blob that can be downloaded, attached to an email, or previewed in an iframe.
 * Caller is responsible for cleanup (URL.revokeObjectURL).
 */

import { pdf } from '@react-pdf/renderer';
import { ValuationReport } from '../components/pdf/ValuationReport';
import type { EngineOutput } from '../engine';

export interface PdfPayload {
  firmName: string;
  city?: string;
  outputs: EngineOutput;
  includeWealthGap: boolean;
  contact?: {
    matt?: { name: string; email: string; calendly?: string };
  };
}

export async function generateValuationPdf(payload: PdfPayload): Promise<Blob> {
  const instance = pdf(<ValuationReport {...payload} />);
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
  // Give browsers a tick to start the download before revoking
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // strip the "data:application/pdf;base64," prefix
      const idx = result.indexOf(',');
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
