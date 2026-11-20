import { NextRequest, NextResponse } from 'next/server';
import { getReportByShareToken } from '@/lib/reports-store';
import { GET as getAnalytics } from '@/app/api/analytics/route';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  const report = getReportByShareToken(params.token);
  if (!report) {
    return NextResponse.json(
      { success: false, error: 'Public report not found or sharing is disabled' },
      { status: 404 }
    );
  }

  const analyticsRes = await getAnalytics();
  const analytics = await analyticsRes.json();

  return NextResponse.json({
    success: true,
    report,
    analytics,
  });
}
