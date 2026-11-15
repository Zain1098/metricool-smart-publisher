import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { timingSafeEqualStrings } from '@/lib/auth';
import { getPublicOrigin, verifyOAuthAccessToken } from '@/lib/mcp-oauth';
import { isSafeMediaUrl, safeErrorMessage } from '@/lib/validation';
import { PublishMode, SocialPlatform } from '@/lib/types';
import { GET as listMediaGet } from '@/app/api/media/route';

export const dynamic = 'force-dynamic';

const VALID_PLATFORMS = new Set<SocialPlatform>([
  'youtube',
  'instagram',
  'facebook',
  'tiktok',
  'twitter',
  'linkedin',
  'threads',
  'pinterest',
]);

const VALID_PUBLISH_MODES = new Set<PublishMode>([
  'native_schedule',
  'publish_now',
  'local_queue',
]);

function verifyMcpBearer(req: NextRequest): { ok: boolean; reason?: string } {
  const auth = req.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ')) {
    return { ok: false, reason: 'Missing Bearer token.' };
  }
  const token = auth.slice('Bearer '.length).trim();

  // 1. Check static MCP_API_KEY (for Cursor / Claude / custom clients)
  const expectedKey = process.env.MCP_API_KEY;
  if (expectedKey && expectedKey.length >= 16 && timingSafeEqualStrings(token, expectedKey)) {
    return { ok: true };
  }

  // 2. Check OAuth 2.1 signed access token (for ChatGPT Connectors)
  if (verifyOAuthAccessToken(token)) {
    return { ok: true };
  }

  return { ok: false, reason: 'Invalid or expired Bearer token.' };
}

function unauthorizedMcpResponse(req: NextRequest, message: string) {
  const origin = getPublicOrigin(req);
  return NextResponse.json(
    { jsonrpc: '2.0', id: null, error: { code: -32001, message } },
    {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        'WWW-Authenticate': `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"`,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type, Mcp-Session-Id',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      },
    }
  );
}

function jsonRpcResult(id: unknown, result: unknown) {
  return NextResponse.json(
    { jsonrpc: '2.0', id: id ?? null, result },
    {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type, Mcp-Session-Id',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      },
    }
  );
}

function jsonRpcError(id: unknown, code: number, message: string, status = 200) {
  return NextResponse.json(
    { jsonrpc: '2.0', id: id ?? null, error: { code, message } },
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type, Mcp-Session-Id',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      },
    }
  );
}

const MCP_TOOLS = [
  {
    name: 'studio_list_accounts',
    description:
      'List all 8 social media channels in ZCodeDev Studio with connection status, handle, followers, and token health (no secrets exposed).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'studio_list_posts',
    description: 'List scheduled, queued, published, failed, or draft posts in ZCodeDev Studio.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['all', 'draft', 'scheduled', 'scheduled_on_platform', 'publishing', 'published', 'failed'],
          description: 'Optional status filter',
        },
        limit: { type: 'number', description: 'Max posts to return (default 25, max 100)' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'studio_create_post',
    description:
      'Create, schedule, or publish a social media post across selected platforms. Use publishMode="local_queue" to safely queue without immediate upload, or "native_schedule"/"publish_now" to dispatch.',
    inputSchema: {
      type: 'object',
      required: ['globalCaption', 'targetPlatforms'],
      properties: {
        globalCaption: { type: 'string', description: 'Main post caption / description' },
        targetPlatforms: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['youtube', 'instagram', 'facebook', 'tiktok', 'twitter', 'linkedin', 'threads', 'pinterest'],
          },
          minItems: 1,
        },
        publishMode: {
          type: 'string',
          enum: ['local_queue', 'native_schedule', 'publish_now'],
          description: 'Default: local_queue',
        },
        scheduledAt: { type: 'string', description: 'ISO-8601 timestamp (optional)' },
        mediaUrl: { type: 'string', description: 'Optional public HTTPS or /api/upload media URL' },
        coverUrl: { type: 'string', description: 'Optional thumbnail/cover image URL' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'studio_publish_post_now',
    description: 'Trigger immediate or native-scheduled publish for an existing post by ID.',
    inputSchema: {
      type: 'object',
      required: ['postId'],
      properties: {
        postId: { type: 'string' },
        useNativeSchedule: { type: 'boolean', description: 'Default false' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'studio_delete_post',
    description: 'Delete a post from the ZCodeDev Studio queue/history by ID.',
    inputSchema: {
      type: 'object',
      required: ['postId'],
      properties: { postId: { type: 'string' } },
      additionalProperties: false,
    },
  },
  {
    name: 'studio_get_analytics',
    description: 'Get multi-platform analytics summary, followers, views, and engagement across connected channels.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'studio_list_media',
    description: 'List uploaded video and media assets stored in R2 / Supabase.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'studio_get_settings',
    description: 'Read current ZCodeDev Studio workspace brand settings and timezone.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'studio_update_settings',
    description: 'Update workspace brandName, timezone, autoOptimalTime, or defaultPublishMode.',
    inputSchema: {
      type: 'object',
      properties: {
        brandName: { type: 'string' },
        timezone: { type: 'string' },
        autoOptimalTime: { type: 'boolean' },
        defaultPublishMode: { type: 'string', enum: ['native_schedule', 'publish_now', 'local_queue'] },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'studio_run_scheduler',
    description: 'Run the due-post scheduler check to dispatch any posts whose scheduledAt has passed.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
];

async function executeTool(name: string, args: Record<string, unknown>) {
  await store.ensureSynced();

  switch (name) {
    case 'studio_list_accounts': {
      const accounts = store.getAccounts();
      return { accounts };
    }

    case 'studio_list_posts': {
      const status = typeof args.status === 'string' ? args.status : 'all';
      const limit = Math.min(Math.max(Number(args.limit) || 25, 1), 100);
      let posts = store.getPosts();
      if (status !== 'all') {
        posts = posts.filter((p) => p.status === status);
      }
      return { total: posts.length, posts: posts.slice(0, limit) };
    }

    case 'studio_create_post': {
      const caption = typeof args.globalCaption === 'string' ? args.globalCaption.trim() : '';
      const platforms = Array.isArray(args.targetPlatforms) ? args.targetPlatforms : [];
      if (!caption) throw new Error('globalCaption is required.');
      if (
        platforms.length === 0 ||
        !platforms.every((p) => typeof p === 'string' && VALID_PLATFORMS.has(p as SocialPlatform))
      ) {
        throw new Error('targetPlatforms must be a non-empty array of valid platforms.');
      }

      const publishMode: PublishMode =
        typeof args.publishMode === 'string' && VALID_PUBLISH_MODES.has(args.publishMode as PublishMode)
          ? (args.publishMode as PublishMode)
          : 'local_queue';

      let scheduledAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      if (args.scheduledAt !== undefined) {
        const parsed = new Date(String(args.scheduledAt));
        if (isNaN(parsed.getTime())) throw new Error('Invalid scheduledAt ISO date.');
        scheduledAt = parsed.toISOString();
      }

      const mediaUrl = typeof args.mediaUrl === 'string' ? args.mediaUrl.trim() : '';
      const coverUrl = typeof args.coverUrl === 'string' ? args.coverUrl.trim() : '';
      if ((mediaUrl && !isSafeMediaUrl(mediaUrl)) || (coverUrl && !isSafeMediaUrl(coverUrl))) {
        throw new Error('Invalid mediaUrl or coverUrl.');
      }

      const created = store.addPost({
        userId: 'mcp_chatgpt',
        publishMode,
        scheduledAt,
        mediaUrl,
        mediaType: 'video',
        mediaFileName: 'mcp_post.mp4',
        mediaDurationSec: 30,
        mediaAspectRatio: '9:16',
        mediaSizeMb: 0,
        coverUrl: coverUrl || undefined,
        thumbOffsetMs: 0,
        globalCaption: caption,
        shortenerEnabled: false,
        targetPlatforms: platforms as SocialPlatform[],
        platformOverrides: {},
      });

      if (publishMode === 'publish_now' || publishMode === 'native_schedule') {
        const execResult = await store.executePostPublish(created.id, {
          useNativeSchedule: publishMode === 'native_schedule',
        });
        return {
          post: execResult.post || created,
          publishedUrls: execResult.publishedUrls,
          errors: execResult.errors,
        };
      }
      return { post: created };
    }

    case 'studio_publish_post_now': {
      const postId = typeof args.postId === 'string' ? args.postId : '';
      if (!postId) throw new Error('postId is required.');
      const res = await store.executePostPublish(postId, {
        useNativeSchedule: Boolean(args.useNativeSchedule),
      });
      if (!res.post) throw new Error('Post not found.');
      return res;
    }

    case 'studio_delete_post': {
      const postId = typeof args.postId === 'string' ? args.postId : '';
      if (!postId) throw new Error('postId is required.');
      const ok = store.deletePost(postId);
      if (!ok) throw new Error('Post not found.');
      return { deleted: true, postId };
    }

    case 'studio_get_analytics': {
      const accounts = store.getAccounts();
      const posts = store.getPosts();
      const metrics = store.getAnalytics();
      return {
        connectedPlatforms: accounts.filter((a) => a.isConnected).map((a) => ({
          platform: a.platform,
          accountName: a.accountName,
          handle: a.handle,
          followersCount: a.followersCount,
          postsCount: a.postsCount || 0,
          viewsCount: a.viewsCount || 0,
        })),
        totalPosts: posts.length,
        publishedPosts: posts.filter((p) => p.status === 'published').length,
        scheduledPosts: posts.filter((p) => p.status === 'scheduled' || p.status === 'scheduled_on_platform').length,
        metricsCount: metrics.length,
        recentMetrics: metrics.slice(-20),
      };
    }

    case 'studio_list_media': {
      const res = await listMediaGet();
      const data = await res.json();
      return data;
    }

    case 'studio_get_settings': {
      return { settings: store.getSettings() };
    }

    case 'studio_update_settings': {
      const patch: Record<string, unknown> = {};
      if (typeof args.brandName === 'string' && args.brandName.trim()) {
        patch.brandName = args.brandName.trim().slice(0, 80);
      }
      if (typeof args.timezone === 'string' && args.timezone.trim()) {
        patch.timezone = args.timezone.trim().slice(0, 64);
      }
      if (typeof args.autoOptimalTime === 'boolean') {
        patch.autoOptimalTime = args.autoOptimalTime;
      }
      if (
        typeof args.defaultPublishMode === 'string' &&
        VALID_PUBLISH_MODES.has(args.defaultPublishMode as PublishMode)
      ) {
        patch.defaultPublishMode = args.defaultPublishMode;
      }
      const settings = store.updateSettings(patch);
      return { settings };
    }

    case 'studio_run_scheduler': {
      const result = await store.triggerCronCheck();
      return result;
    }

    default:
      throw new Error(`Unknown MCP tool: ${name}`);
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, Mcp-Session-Id',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    },
  });
}

export async function GET(req: NextRequest) {
  const auth = verifyMcpBearer(req);
  if (!auth.ok) {
    return unauthorizedMcpResponse(req, auth.reason || 'Unauthorized');
  }
  return NextResponse.json({
    name: 'zcodedev-studio-mcp',
    version: '1.0.0',
    protocolVersion: '2024-11-05',
    toolsCount: MCP_TOOLS.length,
    status: 'ready',
  });
}

export async function POST(req: NextRequest) {
  const auth = verifyMcpBearer(req);
  if (!auth.ok) {
    return unauthorizedMcpResponse(req, auth.reason || 'Unauthorized');
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonRpcError(null, -32700, 'Parse error: Invalid JSON', 400);
  }

  const id = body.id ?? null;
  const method = typeof body.method === 'string' ? body.method : '';
  const params = (body.params && typeof body.params === 'object' ? body.params : {}) as Record<string, unknown>;

  if (method === 'initialize') {
    return jsonRpcResult(id, {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'zcodedev-studio-mcp', version: '1.0.0' },
    });
  }

  if (method === 'notifications/initialized' || method === 'ping') {
    return jsonRpcResult(id, {});
  }

  if (method === 'tools/list') {
    return jsonRpcResult(id, { tools: MCP_TOOLS });
  }

  if (method === 'tools/call') {
    const toolName = typeof params.name === 'string' ? params.name : '';
    const toolArgs = (
      params.arguments && typeof params.arguments === 'object' ? params.arguments : {}
    ) as Record<string, unknown>;

    try {
      const output = await executeTool(toolName, toolArgs);
      return jsonRpcResult(id, {
        content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
      });
    } catch (err: unknown) {
      return jsonRpcResult(id, {
        isError: true,
        content: [{ type: 'text', text: safeErrorMessage(err, 'Tool execution failed') }],
      });
    }
  }

  return jsonRpcError(id, -32601, `Method not found: ${method}`);
}
