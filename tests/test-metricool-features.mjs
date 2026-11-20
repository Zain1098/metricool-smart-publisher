/**
 * Complete End-to-End Test Suite for Metricool Features
 * Tests: Reporting Studio, Web Pixel, SmartLinks, Evergreen Flows, Competitors & Hashtags, and 8-Platform Analytics.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

let passed = 0;
let failed = 0;

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local');
  const vars = {};
  if (!fs.existsSync(envPath)) return vars;
  const lines = fs.readFileSync(envPath, 'utf-8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    vars[key] = val;
  }
  return vars;
}

async function test(name, fn) {
  try {
    await fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  [FAIL] ${name}`);
    console.error(`         ${err?.message || err}`);
    failed++;
  }
}

async function run() {
  console.log(`\nRunning Complete Metricool Feature Suite against ${BASE_URL}\n`);

  const envLocal = loadEnvLocal();
  let cookieHeader = '';

  // 0. Authenticate if ADMIN_PASSWORD is configured
  await test('Auth: Login session established', async () => {
    const email = envLocal.ADMIN_EMAIL || 'admin@zcodedev.com';
    const password = envLocal.ADMIN_PASSWORD || '';
    if (!password) {
      // Check if /api/analytics is accessible without auth
      const probe = await fetch(`${BASE_URL}/api/analytics`);
      assert.ok(probe.status === 200 || probe.status === 401, `Unexpected status ${probe.status}`);
      return;
    }
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    assert.strictEqual(res.status, 200, `Login failed with status ${res.status}`);
    const setCookie = res.headers.get('set-cookie');
    assert.ok(setCookie, 'Expected Set-Cookie header from login');
    cookieHeader = setCookie.split(';')[0];
  });

  const authHeaders = cookieHeader ? { Cookie: cookieHeader } : {};

  // 1. Public Pixel & Static Script
  await test('Web Pixel: /pixel.js serves tracking script', async () => {
    const res = await fetch(`${BASE_URL}/pixel.js`);
    assert.strictEqual(res.status, 200);
    const js = await res.text();
    assert.ok(js.includes('/api/pixel/collect'), 'pixel.js must target /api/pixel/collect');
  });

  await test('Web Pixel: POST /api/pixel/collect records public pageview', async () => {
    const res = await fetch(`${BASE_URL}/api/pixel/collect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        siteId: 'e2e-test-site',
        sessionId: 'sess_e2e_1',
        event: 'pageview',
        url: `${BASE_URL}/e2e-test`,
        path: '/e2e-test',
        title: 'E2E Test Page',
        referrer: 'https://instagram.com/',
        screen: '1440x900',
      }),
    });
    assert.strictEqual(res.status, 201);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.ok(json.id);
  });

  await test('Web Pixel: GET /api/pixel/stats aggregates recorded pageviews', async () => {
    const res = await fetch(`${BASE_URL}/api/pixel/stats?site=e2e-test-site`, { headers: authHeaders });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.ok(json.totalPageviews >= 1, 'Expected at least 1 pageview');
    assert.ok(json.topPages.some((p) => p.path === '/e2e-test'));
  });

  // 2. Reporting Studio + Public Share Link
  let createdReportId = '';
  let createdShareToken = '';

  await test('Reporting Studio: Create, update, and public-fetch report', async () => {
    const createRes = await fetch(`${BASE_URL}/api/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ title: 'E2E Test Report', brandName: 'ZCodeDev QA' }),
    });
    assert.strictEqual(createRes.status, 201);
    const created = await createRes.json();
    createdReportId = created.report.id;
    createdShareToken = created.report.shareToken;
    assert.ok(createdReportId && createdShareToken);

    const patchRes = await fetch(`${BASE_URL}/api/reports/${createdReportId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ dateRangeLabel: 'Last 7 Days' }),
    });
    assert.strictEqual(patchRes.status, 200);
    const patched = await patchRes.json();
    assert.strictEqual(patched.report.dateRangeLabel, 'Last 7 Days');

    // Public anonymous fetch without auth cookie
    const pubRes = await fetch(`${BASE_URL}/api/reports/public/${createdShareToken}`);
    assert.strictEqual(pubRes.status, 200);
    const pubJson = await pubRes.json();
    assert.strictEqual(pubJson.report.id, createdReportId);
    assert.ok(pubJson.analytics?.summary, 'Public report must include live analytics');

    // Cleanup
    const delRes = await fetch(`${BASE_URL}/api/reports/${createdReportId}`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    assert.strictEqual(delRes.status, 200);
  });

  // 3. SmartLinks + Public Click Tracking
  await test('SmartLinks: Create profile, record public click, and delete', async () => {
    const createRes = await fetch(`${BASE_URL}/api/smartlinks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ slug: 'e2e-bio-test', title: 'E2E Bio' }),
    });
    assert.strictEqual(createRes.status, 201);
    const created = await createRes.json();
    const profileId = created.profile.id;

    const clickRes = await fetch(`${BASE_URL}/api/smartlinks/click`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: 'e2e-bio-test' }),
    });
    assert.strictEqual(clickRes.status, 200);
    const clicked = await clickRes.json();
    assert.ok(clicked.profile.totalViews >= 1);

    const delRes = await fetch(`${BASE_URL}/api/smartlinks?id=${encodeURIComponent(profileId)}`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    assert.strictEqual(delRes.status, 200);
  });

  // 4. Evergreen Flows (Autolists)
  await test('Evergreen Flows: Create flow, add item, queue post, and cleanup', async () => {
    const createRes = await fetch(`${BASE_URL}/api/flows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ name: 'E2E Flow', platforms: ['youtube', 'instagram'] }),
    });
    assert.strictEqual(createRes.status, 201);
    const created = await createRes.json();
    const flowId = created.flow.id;

    const patchRes = await fetch(`${BASE_URL}/api/flows`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({
        id: flowId,
        items: [{ id: 'fi_e2e', title: 'E2E Post', caption: 'Testing flow #e2e' }],
      }),
    });
    assert.strictEqual(patchRes.status, 200);

    const runRes = await fetch(`${BASE_URL}/api/flows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ action: 'run_now', id: flowId }),
    });
    assert.strictEqual(runRes.status, 200);
    const queued = await runRes.json();
    assert.ok(queued.queuedPost?.id, 'Expected queuedPost.id from flow run_now');

    // Cleanup queued post and flow
    await fetch(`${BASE_URL}/api/posts/${queued.queuedPost.id}`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    await fetch(`${BASE_URL}/api/flows?id=${encodeURIComponent(flowId)}`, {
      method: 'DELETE',
      headers: authHeaders,
    });
  });

  // 5. Competitors & Hashtags
  await test('Competitors & Hashtags: Track and delete competitor & hashtag', async () => {
    const compRes = await fetch(`${BASE_URL}/api/competitors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ platform: 'youtube', handle: '@zcodedev' }),
    });
    assert.strictEqual(compRes.status, 201);
    const compJson = await compRes.json();
    assert.ok(compJson.competitor?.id);

    const tagRes = await fetch(`${BASE_URL}/api/competitors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ kind: 'hashtag', tag: 'nextjs' }),
    });
    assert.strictEqual(tagRes.status, 201);
    const tagJson = await tagRes.json();
    assert.strictEqual(tagJson.hashtag?.tag, '#nextjs');

    await fetch(`${BASE_URL}/api/competitors?kind=competitor&id=${compJson.competitor.id}`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    await fetch(`${BASE_URL}/api/competitors?kind=hashtag&id=${tagJson.hashtag.id}`, {
      method: 'DELETE',
      headers: authHeaders,
    });
  });

  // 6. 8-Platform Analytics & Page Render Checks
  await test('Analytics API: Returns all 8 platforms in platformBreakdown', async () => {
    const res = await fetch(`${BASE_URL}/api/analytics`, { headers: authHeaders });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.platformBreakdown.length, 8, 'Expected all 8 platforms in breakdown');
  });

  const pages = [
    '/analytics',
    '/reports',
    '/reports/preview/zcodedev-monthly-live',
    '/web-analytics',
    '/smartlinks',
    '/u/zcodedev',
    '/flows',
    '/competitors',
  ];
  for (const p of pages) {
    await test(`Page Render: GET ${p} returns HTTP 200`, async () => {
      const res = await fetch(`${BASE_URL}${p}`, { headers: authHeaders, redirect: 'manual' });
      assert.strictEqual(res.status, 200, `Expected 200 for ${p}, got ${res.status}`);
    });
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

run();
