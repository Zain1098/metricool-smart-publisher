import { NextRequest, NextResponse } from 'next/server';
import { deleteReport, getReportById, updateReport } from '@/lib/reports-store';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const report = getReportById(params.id);
  if (!report) {
    return NextResponse.json({ success: false, error: 'Report not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true, report });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const updated = updateReport(params.id, body);
    if (!updated) {
      return NextResponse.json({ success: false, error: 'Report not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, report: updated });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Invalid payload' },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ok = deleteReport(params.id);
  if (!ok) {
    return NextResponse.json({ success: false, error: 'Report not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
