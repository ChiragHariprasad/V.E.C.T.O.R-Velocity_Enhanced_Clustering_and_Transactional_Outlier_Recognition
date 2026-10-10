import { timingSafeEqual } from 'node:crypto';

export function createCorsOriginValidator(origins) {
  const allowed = new Set(origins);
  return (origin, callback) => {
    if (!origin || allowed.has(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by CORS'));
  };
}

export function createWriteGuard(env = process.env, now = Date.now, requests = new Map()) {
  const windowMs = Number(env.WRITE_RATE_WINDOW_MS || 60_000);
  const limit = Number(env.WRITE_RATE_LIMIT || 10);
  return (req, res) => {
    if (env.DEMO_READ_ONLY !== 'false') {
      res.status(403).json({ error: 'Write operations are disabled.', mode: 'DEMO_READ_ONLY' });
      return true;
    }
    const token = env.API_WRITE_TOKEN || '';
    if (env.NODE_ENV === 'production' && !token) {
      res.status(403).json({ error: 'Write operations require API_WRITE_TOKEN in production.' });
      return true;
    }
    if (token) {
      const supplied = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
      const expectedBytes = Buffer.from(token);
      const suppliedBytes = Buffer.from(supplied);
      if (expectedBytes.length !== suppliedBytes.length || !timingSafeEqual(expectedBytes, suppliedBytes)) {
        res.status(401).json({ error: 'A valid bearer token is required for write operations.' });
        return true;
      }
    }
    const timestamp = now();
    const key = req.ip || req.socket?.remoteAddress || 'unknown';
    const recent = (requests.get(key) || []).filter(item => timestamp - item < windowMs);
    if (recent.length >= limit) {
      res.set('Retry-After', String(Math.ceil(windowMs / 1000)));
      res.status(429).json({ error: 'Write rate limit exceeded.' });
      return true;
    }
    recent.push(timestamp);
    requests.set(key, recent);
    return false;
  };
}

export function validateAnalyzedTransactions(body) {
  const transactions = body?.transactions;
  if (!Array.isArray(transactions) || transactions.length === 0) return 'Request body must contain a non-empty "transactions" array';
  if (transactions.length > 50) return 'Batch size exceeds maximum limit of 50 transactions.';
  if (transactions.some(tx => !isValidTransaction(tx))) {
    return 'Each transaction must have a 64-character hexadecimal txid, bounded string address/numeric amount arrays, and a non-negative numeric fee.';
  }
  return null;
}

export function validateRawTransactions(body) {
  const transactions = body?.transactions;
  if (!Array.isArray(transactions) || transactions.length === 0) return 'Request body must contain a non-empty "transactions" array';
  if (transactions.length > 200) return 'Raw batch size exceeds maximum limit of 200 transactions.';
  if (transactions.some(tx => !isValidTransaction(tx))) {
    return 'Each raw transaction must have a 64-character hexadecimal txid, bounded string address/numeric amount arrays, and a non-negative numeric fee.';
  }
  return null;
}

export function validateInvestigationBody(body = {}) {
  const seedEntityId = body.seed_entity_id || (Array.isArray(body.entities) ? body.entities[0] : '') || '';
  const seedTxid = body.seed_txid || body.seed_transaction_id || (Array.isArray(body.transactions) ? body.transactions[0] : '') || '';
  if ((seedEntityId && (typeof seedEntityId !== 'string' || seedEntityId.length > 100)) ||
      (seedTxid && (typeof seedTxid !== 'string' || !/^[a-fA-F0-9]{64}$/.test(seedTxid)))) {
    return { error: 'seed_entity_id must be a short string and seed_txid must be a 64-character hexadecimal transaction id.' };
  }
  if (!seedEntityId && !seedTxid) return { error: 'Must specify at least seed_entity_id or seed_txid to start an investigation' };
  const title = body.title || `Targeted Investigation: ${seedEntityId || seedTxid.slice(0, 10)}`;
  const priority = body.priority || 'HIGH';
  const notes = body.notes || '';
  if (typeof title !== 'string' || title.length > 160 ||
      !['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(priority) ||
      typeof notes !== 'string' || notes.length > 2000) {
    return { error: 'title must be at most 160 characters, priority must be LOW/MEDIUM/HIGH/CRITICAL, and notes must be at most 2000 characters.' };
  }
  return { seedEntityId, seedTxid, title, priority, notes };
}

function isValidTransaction(tx) {
  return Boolean(tx && typeof tx === 'object' && !Array.isArray(tx) &&
    typeof tx.txid === 'string' && /^[a-fA-F0-9]{64}$/.test(tx.txid) &&
    validStringArray(tx.input_addresses) &&
    validStringArray(tx.output_addresses) &&
    validAmountArray(tx.input_amounts) &&
    validAmountArray(tx.output_amounts) &&
    (tx.fee === undefined || (typeof tx.fee === 'number' && Number.isFinite(tx.fee) && tx.fee >= 0)));
}

function validStringArray(value) {
  return value === undefined || (Array.isArray(value) && value.length <= 100 &&
    value.every(item => typeof item === 'string' && item.length <= 120));
}

function validAmountArray(value) {
  return value === undefined || (Array.isArray(value) && value.length <= 100 &&
    value.every(item => typeof item === 'number' && Number.isFinite(item) && item >= 0));
}
