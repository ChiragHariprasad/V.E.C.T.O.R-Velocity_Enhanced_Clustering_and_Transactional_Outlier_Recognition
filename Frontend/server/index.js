import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { MongoClient } from 'mongodb';
import cors from 'cors';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
const mongoURL = 'mongodb://localhost:27017';
const dbName = 'RedisTransactions';
let db;

// Connect to MongoDB
async function connectToMongo() {
  try {
    const client = new MongoClient(mongoURL);
    await client.connect();
    console.log('Connected to MongoDB');
    db = client.db(dbName);
    
    // Setup change streams to watch for new transactions
    setupChangeStreams();
    
    return client;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

// Setup change streams to watch for new transactions
function setupChangeStreams() {
  const fraudCollection = db.collection('fraud_transactions');
  const legitCollection = db.collection('legit_transactions');
  
  const fraudChangeStream = fraudCollection.watch();
  const legitChangeStream = legitCollection.watch();
  
  fraudChangeStream.on('change', async (change) => {
    if (change.operationType === 'insert') {
      const newTransaction = change.fullDocument;
      console.log('New fraud transaction detected:', newTransaction._id);
      io.emit('newTransaction', newTransaction);
    }
  });
  
  legitChangeStream.on('change', async (change) => {
    if (change.operationType === 'insert') {
      const newTransaction = change.fullDocument;
      console.log('New legitimate transaction detected:', newTransaction._id);
      io.emit('newTransaction', newTransaction);
    }
  });
  
  console.log('Change streams set up successfully');
}

// API Routes
app.get('/api/transactions', async (req, res) => {
  try {
    const fraudTransactions = await db.collection('fraud_transactions').find().toArray();
    const legitTransactions = await db.collection('legit_transactions').find().toArray();
    const allTransactions = [...fraudTransactions, ...legitTransactions];
    
    res.json(allTransactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

app.get('/api/transactions/stats', async (req, res) => {
  try {
    const fraudCount = await db.collection('fraud_transactions').countDocuments();
    const legitCount = await db.collection('legit_transactions').countDocuments();
    const totalCount = fraudCount + legitCount;
    
    const fraudPercentage = totalCount > 0 ? (fraudCount / totalCount) * 100 : 0;
    
    // Calculate average amount
    const fraudAmountCursor = await db.collection('fraud_transactions').aggregate([
      { $group: { _id: null, totalAmount: { $sum: '$Amount' } } }
    ]).toArray();
    
    const legitAmountCursor = await db.collection('legit_transactions').aggregate([
      { $group: { _id: null, totalAmount: { $sum: '$Amount' } } }
    ]).toArray();
    
    const fraudAmount = fraudAmountCursor.length > 0 ? fraudAmountCursor[0].totalAmount : 0;
    const legitAmount = legitAmountCursor.length > 0 ? legitAmountCursor[0].totalAmount : 0;
    const totalAmount = fraudAmount + legitAmount;
    const avgAmount = totalCount > 0 ? totalAmount / totalCount : 0;
    
    res.json({
      totalTransactions: totalCount,
      fraudTransactions: fraudCount,
      legitTransactions: legitCount,
      fraudPercentage: parseFloat(fraudPercentage.toFixed(2)),
      avgAmount: parseFloat(avgAmount.toFixed(2)),
      lastUpdated: new Date()
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch transaction stats' });
  }
});

// Socket.io connection
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await connectToMongo();
});

export default app;