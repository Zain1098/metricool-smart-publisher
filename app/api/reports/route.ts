import { NextRequest, NextResponse } from 'next/server';
import { createReport, listReports } from '@/lib/reports-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const reports = listReports();
  return NextResponse.json({ success: true, reports });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const report = createReport({
      title: body?.title || 'Custom Social Report',
      brandName: body?.brandName,
      dateRangeLabel: body?.dateRangeLabel,
      accentColor: body?.accentColor,
      blocks: Array.isArray(body?.blocks) ? body.blocks : undefined,
    });
    return NextResponse.json({ success: true, report }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Invalid payload' },
      { status: 400 }
    );
  }
}
