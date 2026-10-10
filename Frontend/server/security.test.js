import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCorsOriginValidator,
  createWriteGuard,
  validateAnalyzedTransactions,
  validateRawTransactions,
  validateInvestigationBody
} from './security.js';

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

test('CORS accepts same-origin and explicitly configured origins only', async () => {
  const validate = createCorsOriginValidator(['https://demo.example']);
  assert.equal(await new Promise(resolve => validate(undefined, (_err, allowed) => resolve(allowed))), true);
  assert.equal(await new Promise(resolve => validate('https://demo.example', (_err, allowed) => resolve(allowed))), true);
  const error = await new Promise(resolve => validate('https://other.example', err => resolve(err)));
  assert.match(error.message, /not allowed/);
});

test('write guard defaults to read-only and requires a production token', () => {
  const req = { ip: '127.0.0.1', get: () => '' };
  const readOnlyRes = responseRecorder();
  assert.equal(createWriteGuard({ DEMO_READ_ONLY: 'true' })(req, readOnlyRes), true);
  assert.equal(readOnlyRes.statusCode, 403);

  const productionRes = responseRecorder();
  assert.equal(createWriteGuard({ DEMO_READ_ONLY: 'false', NODE_ENV: 'production' })(req, productionRes), true);
  assert.equal(productionRes.statusCode, 403);
});

test('write guard validates bearer tokens and enforces per-client rate limits', () => {
  let now = 100;
  const env = { DEMO_READ_ONLY: 'false', NODE_ENV: 'production', API_WRITE_TOKEN: 'secret', WRITE_RATE_LIMIT: '1', WRITE_RATE_WINDOW_MS: '1000' };
  const guard = createWriteGuard(env, () => now);
  const req = { ip: 'client', get: () => 'Bearer secret' };
  assert.equal(guard(req, responseRecorder()), false);
  const limited = responseRecorder();
  assert.equal(guard(req, limited), true);
  assert.equal(limited.statusCode, 429);
  assert.equal(limited.headers['Retry-After'], '1');
  now += 1001;
  assert.equal(guard(req, responseRecorder()), false);
});

test('write payload validation rejects malformed and oversized submissions', () => {
  assert.match(validateAnalyzedTransactions({ transactions: [] }), /non-empty/);
  assert.match(validateAnalyzedTransactions({ transactions: [{ txid: 'bad' }] }), /64-character/);
  assert.match(validateAnalyzedTransactions({ transactions: Array.from({ length: 51 }, () => ({ txid: 'a'.repeat(64) })) }), /maximum limit/);
  assert.match(validateRawTransactions({ transactions: [{ txid: 'a'.repeat(64), input_addresses: Array(101).fill('x') }] }), /bounded string address/);
  assert.match(validateRawTransactions({ transactions: [{ txid: 'a'.repeat(64), input_addresses: [{}] }] }), /bounded string address/);
  assert.match(validateAnalyzedTransactions({ transactions: [{ txid: 'a'.repeat(64), fee: -1 }] }), /bounded string address/);
  assert.equal(validateAnalyzedTransactions({ transactions: [{ txid: 'a'.repeat(64) }] }), null);
});

test('investigation validation requires bounded seed and accepted priority', () => {
  assert.match(validateInvestigationBody({}).error, /Must specify/);
  assert.match(validateInvestigationBody({ seed_txid: 'bad' }).error, /64-character/);
  assert.match(validateInvestigationBody({ seed_entity_id: 'ENT_1', priority: 'URGENT' }).error, /priority/);
  assert.equal(validateInvestigationBody({ seed_entity_id: 'ENT_1', priority: 'HIGH' }).seedEntityId, 'ENT_1');
});
