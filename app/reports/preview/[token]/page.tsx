'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import ReportPreviewRenderer, {
  ReportAnalyticsPayload,
} from '@/components/ReportPreviewRenderer';
import type { CustomReport } from '@/lib/reports-store';

export default function PublicReportPreviewPage({
  params,
}: {
  params: { token: string };
}) {
  const [report, setReport] = useState<CustomReport | null>(null);
  const [analytics, setAnalytics] = useState<ReportAnalyticsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/reports/public/${encodeURIComponent(params.token)}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || 'Report not available');
        }
        setReport(json.report);
        setAnalytics(json.analytics);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load report'))
      .finally(() => setLoading(false));
  }, [params.token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-content-muted gap-2">
        <RefreshCw className="w-4 h-4 animate-spin" /> Loading shared report...
      </div>
    );
  }

  if (error || !report || !analytics) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <AlertTriangle className="w-8 h-8 text-amber-500 mb-3" />
        <h1 className="text-lg font-bold">Report Unavailable</h1>
        <p className="text-sm text-content-muted mt-1">{error || 'This link may have been disabled.'}</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 md:px-8">
      <ReportPreviewRenderer report={report} analytics={analytics} showExportBar={true} />
    </div>
  );
}
