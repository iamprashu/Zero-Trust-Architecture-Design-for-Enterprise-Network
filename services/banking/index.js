require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { authorize } = require("./middleware/authorize");

const app = express();
const corsOptions = {
  origin: ["http://localhost:5173", "http://localhost:5002"], // Only allow this domain
  allowedHeaders: ["Content-Type", "Authorization"], // Restrict headers
  credentials: true, // Allow cookies/auth headers
  optionsSuccessStatus: 200, // Legacy browser support
};

app.use(cors(corsOptions));
app.use(express.json());

const PORT = process.env.PORT || 5001;

// Mock databases
let transactions = [];
let accounts = [];

// APIs
app.get("/api/accounts", authorize(["READ_ACCOUNT"]), (req, res) => {
  res.json({ accounts });
});

app.post("/api/account", authorize(["CREATE_ACCOUNT"]), (req, res) => {
  const { ownerName, accountType, initialDeposit } = req.body;
  if (!ownerName)
    return res.status(400).json({ error: "Owner Name is required" });

  const newAccount = {
    accountNumber: Math.floor(
      1000000000 + Math.random() * 9000000000,
    ).toString(),
    ownerName,
    balance: parseFloat(initialDeposit) || 0,
    currency: "USD",
    type: accountType || "CHECKING",
  };
  accounts.push(newAccount);
  res
    .status(201)
    .json({ message: "Account created successfully", account: newAccount });
});

app.delete(
  "/api/account/:accountNumber",
  authorize(["DELETE_ACCOUNT"]),
  (req, res) => {
    const { accountNumber } = req.params;
    const initialLength = accounts.length;
    accounts = accounts.filter((acc) => acc.accountNumber !== accountNumber);
    if (accounts.length === initialLength) {
      return res.status(404).json({ error: "Account not found" });
    }
    res.json({ message: "Account deleted successfully" });
  },
);

app.get(
  "/api/transactions/:accountNumber",
  authorize(["READ_TRANSACTION"]),
  (req, res) => {
    const { accountNumber } = req.params;
    const accountTxs = transactions.filter(
      (tx) => tx.accountNumber === accountNumber,
    );
    res.json({ transactions: accountTxs });
  },
);

app.post("/api/transactions", authorize(["CREATE_TRANSACTION"]), (req, res) => {
  const { accountNumber, amount, type } = req.body;
  const account = accounts.find((acc) => acc.accountNumber === accountNumber);
  if (!account) return res.status(404).json({ error: "Account not found" });

  const numericAmount = parseFloat(amount);
  if (type === "DEBIT") {
    if (account.balance < numericAmount)
      return res.status(400).json({ error: "Insufficient funds" });
    account.balance -= numericAmount;
  } else {
    account.balance += numericAmount;
  }

  const newTx = {
    id: transactions.length + 1,
    accountNumber,
    amount: numericAmount,
    type,
    date: new Date().toISOString(),
  };
  transactions.push(newTx);
  res.status(201).json({
    message: "Transaction successful",
    transaction: newTx,
    newBalance: account.balance,
  });
});

app.post("/api/loan", authorize(["CREATE_LOAN_TRANSACTION"]), (req, res) => {
  const { accountNumber, expectedAmount } = req.body;
  const account = accounts.find((acc) => acc.accountNumber === accountNumber);
  if (!account) return res.status(404).json({ error: "Account not found" });

  const numericAmount = parseFloat(expectedAmount);
  account.balance += numericAmount;
  const tx = {
    id: transactions.length + 1,
    accountNumber,
    amount: numericAmount,
    type: "LOAN",
    date: new Date().toISOString(),
  };
  transactions.push(tx);
  res.status(201).json({
    message: "Loan processed successfully",
    transaction: tx,
    newBalance: account.balance,
  });
});

app.listen(PORT, () => {
  console.log(`Banking service running on port ${PORT}`);
});
