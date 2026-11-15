import { NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { timingSafeEqualStrings } from '@/lib/auth';
import { safeErrorMessage } from '@/lib/validation';

export const dynamic = 'force-dynamic';

function verifyCronAuth(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return false;
  }

  const authHeader = req.headers.get('authorization') || '';
  return timingSafeEqualStrings(authHeader, `Bearer ${cronSecret}`);
}

async function handleCronTrigger(req: Request) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json(
      {
        success: false,
        error: 'Unauthorized. Valid Authorization Bearer header required.',
      },
      { status: 401 }
    );
  }

  try {
    const result = await store.triggerCronCheck();
    return NextResponse.json({
      success: true,
      message: `Cron check executed. Processed ${result.processed} posts (${result.failedIds.length} failed).`,
      publishedIds: result.publishedIds,
      failedIds: result.failedIds,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: safeErrorMessage(err, 'Cron execution failed'),
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  return handleCronTrigger(req);
}

export async function POST(req: Request) {
  return handleCronTrigger(req);
}
