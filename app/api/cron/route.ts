import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';
import {
  SESSION_COOKIE_NAME,
  timingSafeEqualStrings,
  verifySessionToken,
} from '@/lib/auth';
import { safeErrorMessage } from '@/lib/validation';

export const dynamic = 'force-dynamic';

async function verifyCronAuth(req: NextRequest): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization') || '';
  if (cronSecret && timingSafeEqualStrings(authHeader, `Bearer ${cronSecret}`)) {
    return true;
  }

  const sessionToken = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (sessionToken && (await verifySessionToken(sessionToken))) {
    return true;
  }

  return false;
}

async function handleCronTrigger(req: NextRequest) {
  if (!(await verifyCronAuth(req))) {
    return NextResponse.json(
      {
        success: false,
        error: 'Unauthorized. Valid Authorization Bearer header or admin session required.',
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

export async function GET(req: NextRequest) {
  return handleCronTrigger(req);
}

export async function POST(req: NextRequest) {
  return handleCronTrigger(req);
}
