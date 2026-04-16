require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { authorize } = require('./middleware/authorize');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5001;

// Mock database
const transactions = [
  { id: 1, amount: 500, type: 'CREDIT', date: new Date().toISOString() },
  { id: 2, amount: 200, type: 'DEBIT', date: new Date().toISOString() }
];

const account = {
  accountNumber: '1234567890',
  balance: 300,
  currency: 'USD'
};

// APIs
app.get('/api/transactions', authorize(['READ_TRANSACTION']), (req, res) => {
  res.json({ transactions });
});

app.post('/api/transactions', authorize(['CREATE_TRANSACTION']), (req, res) => {
  const { amount, type } = req.body;
  const newTx = { id: transactions.length + 1, amount, type, date: new Date().toISOString() };
  transactions.push(newTx);
  res.status(201).json(newTx);
});

app.get('/api/account', authorize(['READ_ACCOUNT']), (req, res) => {
  res.json({ account });
});

app.post('/api/account', authorize(['CREATE_ACCOUNT']), (req, res) => {
  const { accountType, initialDeposit } = req.body;
  // Mock logic to handle new account creation
  const newAccount = {
    accountNumber: Math.floor(1000000000 + Math.random() * 9000000000).toString(),
    balance: initialDeposit || 0,
    currency: 'USD',
    type: accountType || 'CHECKING'
  };
  res.status(201).json({ message: 'Account created successfully', account: newAccount });
});

app.post('/api/transfer', authorize(['TRANSFER_MONEY']), (req, res) => {
  const { expectedAmount, destination } = req.body;
  if (account.balance < expectedAmount) {
    return res.status(400).json({ error: 'Insufficient funds' });
  }
  account.balance -= expectedAmount;
  const tx = { id: transactions.length + 1, amount: expectedAmount, type: 'TRANSFER', to: destination, date: new Date().toISOString() };
  transactions.push(tx);
  res.json({ message: 'Transfer successful', transaction: tx, newBalance: account.balance });
});

app.listen(PORT, () => {
  console.log(`Banking service running on port ${PORT}`);
});
