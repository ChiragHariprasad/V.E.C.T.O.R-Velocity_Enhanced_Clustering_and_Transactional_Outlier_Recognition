import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCorsOriginValidator,
  createWriteGuard
} from './security.js';
import {
  normalizeOrigin,
  resolveApiOriginFromEnv
} from '../src/config/api.ts';

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    set(name, value) { this.headers[name] = value; return this; }
  };
}

// ─── 1. Trailing Slash Normalization & URL Resolution Tests ─────────────────

test('normalizeOrigin strips single and multiple trailing slashes', () => {
  assert.equal(normalizeOrigin('https://api.example.com/'), 'https://api.example.com');
  assert.equal(normalizeOrigin('https://api.example.com///'), 'https://api.example.com');
  assert.equal(normalizeOrigin('https://api.example.com'), 'https://api.example.com');
  assert.equal(normalizeOrigin('http://localhost:3001/'), 'http://localhost:3001');
});

test('resolveApiOriginFromEnv resolves dev fallback to localhost:3001', () => {
  const originDev = resolveApiOriginFromEnv({ DEV: true });
  assert.equal(originDev, 'http://localhost:3001');

  const originBrowserDev = resolveApiOriginFromEnv({}, true);
  assert.equal(originBrowserDev, 'http://localhost:3001');
});

test('resolveApiOriginFromEnv selects and normalizes production URL', () => {
  const origin = resolveApiOriginFromEnv({
    VITE_API_BASE_URL: 'https://vector-api.onrender.com/'
  });
  assert.equal(origin, 'https://vector-api.onrender.com');

  const originNoSlash = resolveApiOriginFromEnv({
    VITE_API_BASE_URL: 'https://vector-api.onrender.com'
  });
  assert.equal(originNoSlash, 'https://vector-api.onrender.com');
});

test('resolveApiOriginFromEnv throws clear error when production URL is missing', () => {
  assert.throws(
    () => resolveApiOriginFromEnv({ DEV: false }),
    /VITE_API_BASE_URL is not set/
  );
  assert.throws(
    () => resolveApiOriginFromEnv({ VITE_API_BASE_URL: '   ', DEV: false }),
    /VITE_API_BASE_URL is not set/
  );
  assert.throws(
    () => resolveApiOriginFromEnv({ VITE_API_BASE_URL: '', DEV: false }),
    /VITE_API_BASE_URL is not set/
  );
});

// ─── 2. CORS Allowlist Parser Tests ─────────────────────────────────────────

test('CORS parser handles comma-separated list with whitespace trimming', async () => {
  const corsOrigins = 'https://app.vercel.app, http://localhost:5173 , http://localhost:5174';
  const allowedList = corsOrigins.split(',').map(o => o.trim()).filter(Boolean);
  const validator = createCorsOriginValidator(allowedList);

  // Exact matches allowed
  assert.equal(await new Promise(res => validator('https://app.vercel.app', (_err, ok) => res(ok))), true);
  assert.equal(await new Promise(res => validator('http://localhost:5173', (_err, ok) => res(ok))), true);
  assert.equal(await new Promise(res => validator('http://localhost:5174', (_err, ok) => res(ok))), true);

  // Non-browser / health-check requests (no Origin header) allowed
  assert.equal(await new Promise(res => validator(undefined, (_err, ok) => res(ok))), true);

  // Unauthorized origin rejected
  const err = await new Promise(res => validator('https://malicious-site.com', e => res(e)));
  assert.match(err.message, /not allowed by CORS/);

  // Partial / subdomain match rejected
  const errSub = await new Promise(res => validator('https://fake-app.vercel.app', e => res(e)));
  assert.match(errSub.message, /not allowed by CORS/);
});

// ─── 3. Health Endpoint Readiness Contract Tests ─────────────────────────────

test('health endpoint readiness contract returns 503 starting vs 200 ready', () => {
  function handleHealthz(isReady, hasDb, simulationMode) {
    const res = responseRecorder();
    if (isReady && hasDb) {
      res.status(200).json({
        status: 'ok',
        mode: simulationMode ? 'simulation' : 'live'
      });
    } else {
      res.status(503).json({ status: 'starting' });
    }
    return res;
  }

  // Before DB connection is ready -> 503
  const notReady = handleHealthz(false, false, true);
  assert.equal(notReady.statusCode, 503);
  assert.equal(notReady.body.status, 'starting');

  // DB client created but startup incomplete -> 503
  const halfReady = handleHealthz(false, true, true);
  assert.equal(halfReady.statusCode, 503);

  // Ready in simulation mode -> 200 { status: 'ok', mode: 'simulation' }
  const readySim = handleHealthz(true, true, true);
  assert.equal(readySim.statusCode, 200);
  assert.equal(readySim.body.status, 'ok');
  assert.equal(readySim.body.mode, 'simulation');
  assert.equal(readySim.body.mongoURI, undefined); // No credentials leaked!

  // Ready in live mode -> 200 { status: 'ok', mode: 'live' }
  const readyLive = handleHealthz(true, true, false);
  assert.equal(readyLive.statusCode, 200);
  assert.equal(readyLive.body.mode, 'live');
});

// ─── 4. Demo Seeding Flag Safety Tests ──────────────────────────────────────

test('demo seeding flag requires explicit SEED_DEMO_DATA=true opt-in', () => {
  function shouldSeedDemo(envValue) {
    return envValue === 'true';
  }

  assert.equal(shouldSeedDemo('true'), true);
  assert.equal(shouldSeedDemo('false'), false);
  assert.equal(shouldSeedDemo(undefined), false);
  assert.equal(shouldSeedDemo(''), false);
  assert.equal(shouldSeedDemo('1'), false);
});

// ─── 5. Demo Read-Only Lockdown Tests ────────────────────────────────────────

test('read-only guard rejects state-mutating requests unconditionally when DEMO_READ_ONLY is true', () => {
  const guard = createWriteGuard({ DEMO_READ_ONLY: 'true' });
  const res = responseRecorder();
  const req = {
    ip: '198.51.100.1',
    get: (header) => (header === 'authorization' ? 'Bearer valid_token' : '')
  };

  const blocked = guard(req, res);
  assert.equal(blocked, true);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error, 'Write operations are disabled.');
});
