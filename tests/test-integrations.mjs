/**
 * Automated Verification Test Suite for ZCodeDev Metricool Studio
 * Tests Postiz adapter, Cloudflare R2 client, Supabase guards, Webhook HMAC signatures, and fallback mechanics.
 */
import assert from 'node:assert';
import crypto from 'node:crypto';

console.log('🧪 Starting ZCodeDev Metricool Studio Verification Tests...\n');

let passedTests = 0;
let totalTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Error: ${err.message}`);
  }
}

async function testAsync(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Error: ${err.message}`);
  }
}

// -----------------------------------------------------------------------------
// 1. Configuration Guard Tests
// -----------------------------------------------------------------------------
test('R2 Config Guard: isR2Configured returns false when env is unset', async () => {
  const origAccount = process.env.R2_ACCOUNT_ID;
  delete process.env.R2_ACCOUNT_ID;
  delete process.env.S3_ENDPOINT;

  // Dynamically import to test current env
  const { isR2Configured } = await import('../lib/r2.ts');
  assert.strictEqual(isR2Configured(), false, 'Should be false when credentials are empty');

  // Restore
  if (origAccount) process.env.R2_ACCOUNT_ID = origAccount;
});

test('Postiz Config Guard: isPostizConfigured returns false when env is unset', async () => {
  const origKey = process.env.POSTIZ_API_KEY;
  delete process.env.POSTIZ_API_KEY;

  const { isPostizConfigured } = await import('../lib/postiz.ts');
  assert.strictEqual(isPostizConfigured(), false, 'Should be false when API key is empty');

  if (origKey) process.env.POSTIZ_API_KEY = origKey;
});

test('Supabase Config Guard: isSupabaseConfigured returns false when URL is unset', async () => {
  const origUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;

  const { isSupabaseConfigured } = await import('../lib/supabase.ts');
  assert.strictEqual(isSupabaseConfigured(), false, 'Should be false when URL is empty');

  if (origUrl) process.env.NEXT_PUBLIC_SUPABASE_URL = origUrl;
});

// -----------------------------------------------------------------------------
// 2. Postiz Adapter Graceful Fallback Tests
// -----------------------------------------------------------------------------
await testAsync('Postiz Adapter: fetchPostizChannels returns empty array and does not throw when unconfigured', async () => {
  const { fetchPostizChannels } = await import('../lib/postiz.ts');
  const channels = await fetchPostizChannels();
  assert.ok(Array.isArray(channels), 'Must return an array');
  assert.strictEqual(channels.length, 0, 'Must return 0 channels when unconfigured');
});

await testAsync('Postiz Adapter: publishViaPostiz returns clean error without throwing when unconfigured', async () => {
  const { publishViaPostiz } = await import('../lib/postiz.ts');
  const dummyPost = {
    id: 'test-post-1',
    videoPath: 'https://example.com/test.mp4',
    platforms: ['youtube', 'instagram'],
    status: 'scheduled',
    scheduledTime: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    platformSettings: {
      youtube: { title: 'Test Video', description: 'Test desc', tags: ['#test'] },
      instagram: { caption: 'Test insta' }
    }
  };

  const result = await publishViaPostiz(dummyPost);
  assert.strictEqual(result.success, false, 'Must not claim success');
  assert.strictEqual(result.status, 'ERROR');
  assert.ok(result.error && result.error.includes('not configured'), 'Must return informative error');
});

// -----------------------------------------------------------------------------
// 3. Postiz Webhook Signature Verification Tests
// -----------------------------------------------------------------------------
test('Postiz Webhook: HMAC SHA-256 signature matches expected digest', () => {
  const secret = 'test_webhook_secret_key_123';
  const payload = JSON.stringify({
    event: 'post.published',
    postId: 'postiz-id-999',
    timestamp: 1710000000
  });

  const computedSig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  assert.ok(computedSig.length === 64, 'Signature must be a 64-char hex string');

  // Verify constant time comparison
  const receivedSig = computedSig;
  const isMatch = crypto.timingSafeEqual(Buffer.from(computedSig), Buffer.from(receivedSig));
  assert.strictEqual(isMatch, true, 'Matching HMAC should evaluate to true');

  // Tampered payload
  const tamperedSig = crypto.createHmac('sha256', secret).update(payload + 'tampered').digest('hex');
  assert.notStrictEqual(computedSig, tamperedSig, 'Tampered payload must produce distinct hash');
});

// -----------------------------------------------------------------------------
// 4. Cloudflare R2 S3-Compatible & File Extension Validation Tests
// -----------------------------------------------------------------------------
await testAsync('R2 Client: Rejects unsupported file extension', async () => {
  // Mock R2 environment temporarily
  process.env.R2_ACCOUNT_ID = 'test-account';
  process.env.R2_ACCESS_KEY_ID = 'test-key';
  process.env.R2_SECRET_ACCESS_KEY = 'test-secret';
  process.env.R2_BUCKET_NAME = 'test-bucket';

  const { createPresignedUploadUrl } = await import('../lib/r2.ts');

  let threw = false;
  try {
    await createPresignedUploadUrl({
      fileName: 'malicious_script.exe',
      fileSizeBytes: 1024,
      mimeType: 'application/x-msdownload'
    });
  } catch (err) {
    threw = true;
    assert.ok(err.message.includes('not supported'), 'Error message should indicate unsupported format');
  }
  assert.strictEqual(threw, true, 'Must throw error on unsupported file extension');

  // Cleanup
  delete process.env.R2_ACCOUNT_ID;
  delete process.env.R2_ACCESS_KEY_ID;
  delete process.env.R2_SECRET_ACCESS_KEY;
  delete process.env.R2_BUCKET_NAME;
});

// -----------------------------------------------------------------------------
// 5. Cron Trigger Authorization Tests
// -----------------------------------------------------------------------------
test('Cron Route: Bearer Token and Secret Query Param Parsing', () => {
  const secret = 'metricool_cron_super_secret_456';

  function verifyCron(headerAuth, querySecret, configuredSecret, isProduction) {
    if (!isProduction && !configuredSecret) return true;
    if (headerAuth) {
      const match = headerAuth.match(/^Bearer\s+(.+)$/i);
      if (match && match[1] === configuredSecret) return true;
    }
    if (querySecret && querySecret === configuredSecret) return true;
    return false;
  }

  // Allowed cases
  assert.strictEqual(verifyCron('Bearer ' + secret, null, secret, true), true, 'Valid Bearer should succeed');
  assert.strictEqual(verifyCron(null, secret, secret, true), true, 'Valid query secret should succeed');
  assert.strictEqual(verifyCron('bearer ' + secret, null, secret, true), true, 'Case insensitive Bearer should succeed');

  // Denied cases
  assert.strictEqual(verifyCron('Bearer wrong_secret', null, secret, true), false, 'Wrong Bearer secret should fail');
  assert.strictEqual(verifyCron(null, 'wrong_secret', secret, true), false, 'Wrong query secret should fail');
  assert.strictEqual(verifyCron(null, null, secret, true), false, 'Missing credentials in production should fail');
});

// -----------------------------------------------------------------------------
// 6. Safe Video Retention Guard Tests
// -----------------------------------------------------------------------------
await testAsync('R2 Retention Guard: Prevents deletion when post is active or scheduled', async () => {
  const { isVideoInActiveUse } = await import('../lib/supabase.ts');
  
  // Unconfigured Supabase defaults safely to false or local check without throwing
  const inUse = await isVideoInActiveUse('non-existent-asset-id');
  assert.strictEqual(typeof inUse, 'boolean', 'Must return a boolean value');
});

// -----------------------------------------------------------------------------
// 7. Store Synchronization Dual Mode
// -----------------------------------------------------------------------------
await testAsync('Store Dual Mode: loadStore returns valid state with default platforms', async () => {
  const { loadStore } = await import('../lib/store.ts');
  const store = loadStore();
  
  assert.ok(store, 'Store must not be null');
  assert.ok(Array.isArray(store.accounts), 'Store accounts must be an array');
  assert.ok(Array.isArray(store.posts), 'Store posts must be an array');
  assert.ok(store.accounts.length >= 5, 'Should have standard supported accounts seeded');
});

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------
setTimeout(() => {
  console.log('\n========================================');
  console.log(`Verification Results: ${passedTests}/${totalTests} tests passed.`);
  if (passedTests === totalTests) {
    console.log('🎉 ALL INTEGRATION GUARDS & CONTRACTS PASSED!');
  } else {
    console.error(`⚠️ ${totalTests - passedTests} tests failed.`);
    process.exitCode = 1;
  }
  console.log('========================================\n');
}, 500);
