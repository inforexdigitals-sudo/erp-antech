import { useState } from 'react';
import { ApiError, downloadFile } from '../lib/api-client';
import { Button } from './ui/Button';

/** Shared by every module's PDF export button (Quotations, Purchase Orders, Invoices, Payment Certificates) — see apps/api's *-pdf.service.ts. */
export function DownloadPdfButton({
  path,
  filename,
  label = 'Download PDF',
  onError,
}: {
  path: string;
  filename: string;
  label?: string;
  onError?: (message: string) => void;
}) {
  const [downloading, setDownloading] = useState(false);

  async function onClick() {
    setDownloading(true);
    try {
      await downloadFile(path, filename);
    } catch (err) {
      onError?.(err instanceof ApiError ? err.message : 'Could not download the PDF.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Button onClick={onClick} disabled={downloading}>
      {downloading ? 'Downloading…' : label}
    </Button>
  );
}
