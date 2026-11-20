import crypto from 'crypto';
import { readJsonStore, writeJsonStore } from './json-store';

export type ReportBlockType =
  | 'kpi_summary'
  | 'platform_breakdown'
  | 'growth_timeline'
  | 'top_videos'
  | 'topic_insights'
  | 'executive_notes';

export interface ReportBlock {
  id: string;
  type: ReportBlockType;
  title: string;
  enabled: boolean;
  notes?: string;
}

export interface CustomReport {
  id: string;
  title: string;
  brandName: string;
  dateRangeLabel: string;
  accentColor: string;
  shareToken: string;
  isPublic: boolean;
  blocks: ReportBlock[];
  createdAt: string;
  updatedAt: string;
}

const REPORTS_FILE = 'reports.json';

export const DEFAULT_REPORT_BLOCKS: ReportBlock[] = [
  { id: 'blk_kpi', type: 'kpi_summary', title: 'Executive KPI Summary', enabled: true },
  { id: 'blk_platforms', type: 'platform_breakdown', title: 'Cross-Platform Breakdown', enabled: true },
  { id: 'blk_timeline', type: 'growth_timeline', title: 'Views & Engagement Timeline', enabled: true },
  { id: 'blk_videos', type: 'top_videos', title: 'Top Performing Videos', enabled: true },
  { id: 'blk_topics', type: 'topic_insights', title: 'Topic & Best-Time Intelligence', enabled: true },
  {
    id: 'blk_notes',
    type: 'executive_notes',
    title: 'Strategist Notes & Next Steps',
    enabled: true,
    notes: 'Consistent short-form uploads during peak evening hours drove the highest engagement rate.',
  },
];

function getInitialReports(): CustomReport[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'rep_default_monthly',
      title: 'Monthly Social Performance Report',
      brandName: 'ZCodeDev',
      dateRangeLabel: 'Last 30 Days',
      accentColor: '#C27345',
      shareToken: 'zcodedev-monthly-live',
      isPublic: true,
      blocks: DEFAULT_REPORT_BLOCKS,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

export function listReports(): CustomReport[] {
  const stored = readJsonStore<CustomReport[] | null>(REPORTS_FILE, null);
  if (!stored || stored.length === 0) {
    const initial = getInitialReports();
    writeJsonStore(REPORTS_FILE, initial);
    return initial;
  }
  return stored;
}

export function getReportById(id: string): CustomReport | undefined {
  return listReports().find((r) => r.id === id);
}

export function getReportByShareToken(token: string): CustomReport | undefined {
  return listReports().find((r) => r.shareToken === token && r.isPublic);
}

export function createReport(input: {
  title: string;
  brandName?: string;
  dateRangeLabel?: string;
  accentColor?: string;
  blocks?: ReportBlock[];
}): CustomReport {
  const reports = listReports();
  const now = new Date().toISOString();
  const report: CustomReport = {
    id: `rep_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    title: input.title.trim() || 'Untitled Performance Report',
    brandName: input.brandName?.trim() || 'ZCodeDev',
    dateRangeLabel: input.dateRangeLabel?.trim() || 'Last 30 Days',
    accentColor: input.accentColor || '#C27345',
    shareToken: crypto.randomBytes(8).toString('hex'),
    isPublic: true,
    blocks: input.blocks && input.blocks.length > 0 ? input.blocks : DEFAULT_REPORT_BLOCKS,
    createdAt: now,
    updatedAt: now,
  };
  reports.unshift(report);
  writeJsonStore(REPORTS_FILE, reports);
  return report;
}

export function updateReport(
  id: string,
  patch: Partial<Omit<CustomReport, 'id' | 'createdAt'>>
): CustomReport | null {
  const reports = listReports();
  const idx = reports.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  const updated: CustomReport = {
    ...reports[idx],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  reports[idx] = updated;
  writeJsonStore(REPORTS_FILE, reports);
  return updated;
}

export function deleteReport(id: string): boolean {
  const reports = listReports();
  const filtered = reports.filter((r) => r.id !== id);
  if (filtered.length === reports.length) return false;
  writeJsonStore(REPORTS_FILE, filtered);
  return true;
}
