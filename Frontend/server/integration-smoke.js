import { randomBytes } from 'node:crypto';
import { io } from 'socket.io-client';

const baseUrl = (process.env.VECTOR_SMOKE_BASE_URL || 'http://127.0.0.1:3001').replace(/\/$/, '');
const target = new URL(baseUrl);

if (process.env.VECTOR_SMOKE_ALLOW_WRITE !== 'true') {
  throw new Error('Set VECTOR_SMOKE_ALLOW_WRITE=true to opt in to one synthetic transaction write.');
}
if (!['localhost', '127.0.0.1', '::1'].includes(target.hostname)) {
  throw new Error('This integration smoke script only writes to a localhost server.');
}

const txid = randomBytes(32).toString('hex');
const transaction = {
  txid,
  timestamp: Math.floor(Date.now() / 1000),
  input_count: 1,
  output_count: 1,
  input_addresses: [`smoke-in-${txid.slice(0, 12)}`],
  output_addresses: [`smoke-out-${txid.slice(0, 12)}`],
  input_amounts: [1.0],
  output_amounts: [0.999],
  total_input_btc: 1.0,
  total_output_btc: 0.999,
  fee: 0.001,
  fee_btc: 0.001,
};

const socket = io(baseUrl, { transports: ['websocket'], timeout: 5000 });
const closeSocket = () => socket.disconnect();

try {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Socket.IO connection timed out.')), 7000);
    socket.once('connect', () => { clearTimeout(timeout); resolve(); });
    socket.once('connect_error', error => { clearTimeout(timeout); reject(error); });
  });

  const eventPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`No bitcoin:newTransaction event received for ${txid}.`)), 30000);
    socket.on('bitcoin:newTransaction', event => {
      if (event?.txid === txid) {
        clearTimeout(timeout);
        resolve(event);
      }
    });
  });
  eventPromise.catch(() => {});

  const headers = { 'Content-Type': 'application/json' };
  if (process.env.VECTOR_SMOKE_API_TOKEN) {
    headers.Authorization = `Bearer ${process.env.VECTOR_SMOKE_API_TOKEN}`;
  }

  const ingestResponse = await fetch(`${baseUrl}/api/bitcoin/ingest`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ transactions: [transaction] }),
    signal: AbortSignal.timeout(35000),
  });
  const ingestBody = await ingestResponse.json();
  if (ingestResponse.status !== 201 || ingestBody.status !== 'SUCCESS') {
    throw new Error(`Analysis request failed (${ingestResponse.status}): ${JSON.stringify(ingestBody)}`);
  }

  const analyzed = ingestBody.transactions?.find(item => item.txid === txid);
  if (!analyzed || typeof analyzed.risk_score !== 'number' || !analyzed.ml_model_type) {
    throw new Error('Analysis response did not include this transaction with a risk score and model state.');
  }

  const persistedResponse = await fetch(`${baseUrl}/api/bitcoin/transactions/${txid}`, {
    signal: AbortSignal.timeout(10000),
  });
  const persisted = await persistedResponse.json();
  if (persistedResponse.status !== 200 || persisted?.txid !== txid) {
    throw new Error(`GET by txid did not return the persisted transaction (${persistedResponse.status}).`);
  }

  const event = await eventPromise;
  console.log(JSON.stringify({
    status: 'PASS',
    txid,
    analysis_status: ingestBody.status,
    model_type: analyzed.ml_model_type,
    risk_score: analyzed.risk_score,
    persisted: persisted.txid === txid,
    socket_event: event.txid,
  }, null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  closeSocket();
}
