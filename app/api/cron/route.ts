import { NextResponse } from 'next/server';
import { store } from '@/lib/store';

export const dynamic = 'force-dynamic';

function verifyCronAuth(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    // In local development with no secret defined, allow trigger
    return true;
  }

  const authHeader = req.headers.get('authorization');
  if (authHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  const { searchParams } = new URL(req.url);
  const querySecret = searchParams.get('secret') || searchParams.get('key');
  if (querySecret === cronSecret) {
    return true;
  }

  return false;
}

async function handleCronTrigger(req: Request) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json(
      {
        success: false,
        error: 'Unauthorized. Valid Authorization Bearer header or ?secret= parameter required.',
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
    const errorMsg = err instanceof Error ? err.message : 'Cron execution failed';
    return NextResponse.json(
      { success: false, error: errorMsg, timestamp: new Date().toISOString() },
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
