import { NextRequest, NextResponse } from 'next/server';
import { createFlow, deleteFlow, listFlows, updateFlow } from '@/lib/flows-store';
import { store } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ success: true, flows: listFlows() });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body?.action === 'run_now' && body?.id) {
      const flow = listFlows().find((f) => f.id === body.id);
      if (!flow || flow.items.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Flow has no items to queue' },
          { status: 400 }
        );
      }

      const idx = flow.cursorIndex % flow.items.length;
      const item = flow.items[idx];
      const scheduledAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

      const platformOverrides: Record<string, { title: string; caption: string }> = {};
      for (const p of flow.platforms) {
        platformOverrides[p] = { title: item.title, caption: item.caption };
      }

      const createdPost = await store.addPost({
        userId: 'default',
        status: 'scheduled',
        publishMode: 'local_queue',
        scheduledAt,
        targetPlatforms: flow.platforms,
        globalCaption: item.caption,
        mediaUrl: item.mediaUrl || '',
        mediaType: 'video',
        mediaFileName: `${item.title.toLowerCase().replace(/\s+/g, '-')}.mp4`,
        platformOverrides: platformOverrides as any,
      });

      const nextCursor = flow.repeatLoop
        ? (idx + 1) % flow.items.length
        : Math.min(idx + 1, flow.items.length);

      const updated = updateFlow(flow.id, {
        cursorIndex: nextCursor,
        lastRunAt: new Date().toISOString(),
      });

      return NextResponse.json({ success: true, flow: updated, queuedPost: createdPost });
    }

    const flow = createFlow({
      name: body?.name || 'New Evergreen Flow',
      platforms: body?.platforms,
      frequencyHours: Number(body?.frequencyHours || 24),
      repeatLoop: body?.repeatLoop,
    });
    return NextResponse.json({ success: true, flow }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Invalid payload' },
      { status: 400 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body?.id) {
      return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });
    }
    const updated = updateFlow(body.id, body);
    if (!updated) {
      return NextResponse.json({ success: false, error: 'Flow not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, flow: updated });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Invalid payload' },
      { status: 400 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });
  return NextResponse.json({ success: deleteFlow(id) });
}
