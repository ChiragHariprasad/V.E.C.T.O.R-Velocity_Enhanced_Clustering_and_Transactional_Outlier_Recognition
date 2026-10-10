import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mongoURL = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const dbName = process.env.MONGO_DB_NAME || 'RedisTransactions';

async function parseCSV(filePath, limit = 2000) {
  if (!fs.existsSync(filePath)) return [];
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
  
  const records = [];
  let headers = [];
  let isHeader = true;

  for await (const line of rl) {
    if (!line.trim()) continue;
    const parts = line.split(',').map(s => s.trim());
    if (isHeader) {
      headers = parts;
      isHeader = false;
      continue;
    }

    const row = {};
    headers.forEach((h, i) => {
      row[h] = parts[i];
    });
    records.push(row);
    if (records.length >= limit) break;
  }
  return records;
}

export async function seedDatabase(force = false) {
  const client = new MongoClient(mongoURL);
  await client.connect();
  const db = client.db(dbName);
  
  const fraudCollection = db.collection('fraud_transactions');
  const legitCollection = db.collection('legit_transactions');

  const fraudCount = await fraudCollection.countDocuments();
  const legitCount = await legitCollection.countDocuments();

  if (!force && (fraudCount > 0 || legitCount > 0)) {
    console.log(`Database already has data (${fraudCount} fraud, ${legitCount} legit).`);
    await client.close();
    return;
  }

  await fraudCollection.deleteMany({});
  await legitCollection.deleteMany({});
  console.log('Cleared existing collections. Seeding rich transaction dataset...');

  const transactionsPath = path.resolve(__dirname, '../../Backend/transactions.csv');
  const syntheticPath = path.resolve(__dirname, '../../Backend/synthetic_txns.csv');
  const fraudPath = path.resolve(__dirname, '../../Backend/fraud.csv');

  const txnRows = await parseCSV(transactionsPath, 1500);
  const syntheticRows = await parseCSV(syntheticPath, 1500);
  const fraudRows = await parseCSV(fraudPath, 1000);

  const legitDocs = [];
  
  // From transactions.csv
  for (const r of txnRows) {
    legitDocs.push({
      User_ID: r.User_ID || 'U000001',
      Date: r.Date || '2020-06-15',
      Time: r.Time || '14:30:00',
      Amount: parseFloat(r.Amount) || 1200,
      Merchant_Category: r.Merchant_Type || 'Electronics',
      Device_Type: r.Device_Type || 'PC',
      Session_Time: parseFloat(r.Session_Time) || 15,
      Active_Loans: parseInt(r.Active_Loan_Count || '0', 10),
      legit_token: crypto.randomBytes(8).toString('hex'),
      fraud_score: parseFloat((Math.random() * 0.25).toFixed(4))
    });
  }

  // From synthetic_txns.csv
  for (const r of syntheticRows) {
    legitDocs.push({
      User_ID: r.User_ID || 'U000001',
      Date: r.Date || '2020-07-01',
      Time: r.Time || '16:45:00',
      Amount: parseFloat(r.Amount) || 2500,
      Merchant_Category: r.Merchant_Category || 'Food Delivery',
      Device_Type: r.Device_Type || 'Mobile',
      Session_Time: parseFloat(r.Session_Time) || 12,
      Active_Loans: parseInt(r.Active_Loans || '0', 10),
      legit_token: crypto.randomBytes(8).toString('hex'),
      fraud_score: parseFloat((Math.random() * 0.28).toFixed(4))
    });
  }

  const fraudDocs = [];
  for (let idx = 0; idx < fraudRows.length; idx++) {
    const r = fraudRows[idx];
    const rawDate = r.Date ? r.Date.split(' ')[0] : '2020-06-10';
    fraudDocs.push({
      User_ID: r.User_ID || 'U000001',
      Date: rawDate,
      Time: r.Time ? (r.Time.includes(' ') ? r.Time.split(' ')[1] : r.Time) : '18:20:00',
      Amount: parseFloat(r.Amount) || 4500,
      Merchant_Category: r.Merchant_Type || r.Merchant_Category || 'Electronics',
      Device_Type: r.Device_Type || (idx % 2 === 0 ? 'PC' : 'Mobile'),
      Session_Time: parseFloat(r.Session_Time) || 18,
      Active_Loans: parseInt(r.Active_Loan_Count || '0', 10),
      fraud_token: idx + 1,
      fraud_score: parseFloat((0.75 + Math.random() * 0.24).toFixed(4)),
      Persona: r.Persona || 'Impulsive Spender'
    });
  }

  // Also add explicitly curated high-match sample records across dates 2015-2024
  const testYears = ['2015', '2018', '2020', '2022', '2024'];
  const testCats = ['Electronics', 'Utilities', 'Groceries', 'Food Delivery', 'Apparel', 'Travel'];
  const testDevs = ['PC', 'Mobile', 'Tablet'];
  
  for (let u = 1; u <= 10; u++) {
    const uid = `U${String(u).padStart(6, '0')}`;
    for (const yr of testYears) {
      for (const cat of testCats) {
        for (const dev of testDevs) {
          fraudDocs.push({
            User_ID: uid,
            Date: `${yr}-06-15`,
            Time: '15:30:00',
            Amount: 3500 + Math.floor(Math.random() * 5000),
            Merchant_Category: cat,
            Device_Type: dev,
            Session_Time: 20,
            Active_Loans: 1,
            fraud_token: fraudDocs.length + 1,
            fraud_score: 0.92,
            Persona: 'High Velocity'
          });
        }
      }
    }
  }

  if (legitDocs.length > 0) {
    await legitCollection.insertMany(legitDocs.map(record => ({
      ...record, data_mode: 'SIMULATION', data_source: 'financial seed fixture'
    })));
    console.log(`✅ Seeded ${legitDocs.length} legitimate transactions.`);
  }

  if (fraudDocs.length > 0) {
    await fraudCollection.insertMany(fraudDocs.map(record => ({
      ...record, data_mode: 'SIMULATION', data_source: 'financial seed fixture'
    })));
    console.log(`✅ Seeded ${fraudDocs.length} fraud transactions.`);
  }

  await client.close();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seedDatabase(true).then(() => {
    console.log('Seed completed successfully!');
    process.exit(0);
  }).catch(err => {
    console.error('Seed error:', err);
    process.exit(1);
  });
}
