require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { connectDB, Account, Transaction } = require("@repo/db");
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

// ─── Account APIs ────────────────────────────────────────────────────────────

// GET /api/accounts  → list all accounts
app.get("/api/accounts", authorize(["READ_ACCOUNT"]), async (req, res) => {
  try {
    const accounts = await Account.find().lean();
    res.json({ accounts });
  } catch (err) {
    console.error("GET /api/accounts error:", err);
    res.status(500).json({ error: "Failed to fetch accounts" });
  }
});

// POST /api/account  → create a new account
app.post("/api/account", authorize(["CREATE_ACCOUNT"]), async (req, res) => {
  try {
    const { ownerName, accountType, initialDeposit } = req.body;
    if (!ownerName)
      return res.status(400).json({ error: "Owner Name is required" });

    const newAccount = new Account({
      accountNumber: Math.floor(
        1000000000 + Math.random() * 9000000000,
      ).toString(),
      ownerName,
      balance: parseFloat(initialDeposit) || 0,
      currency: "USD",
      type: accountType || "CHECKING",
    });

    await newAccount.save();
    res
      .status(201)
      .json({ message: "Account created successfully", account: newAccount });
  } catch (err) {
    console.error("POST /api/account error:", err);
    res.status(500).json({ error: "Failed to create account" });
  }
});

// DELETE /api/account/:accountNumber  → delete an account by account number
app.delete(
  "/api/account/:accountNumber",
  authorize(["DELETE_ACCOUNT"]),
  async (req, res) => {
    try {
      const { accountNumber } = req.params;
      const deleted = await Account.findOneAndDelete({ accountNumber });
      if (!deleted) {
        return res.status(404).json({ error: "Account not found" });
      }
      res.json({ message: "Account deleted successfully" });
    } catch (err) {
      console.error("DELETE /api/account error:", err);
      res.status(500).json({ error: "Failed to delete account" });
    }
  },
);

// ─── Transaction APIs ─────────────────────────────────────────────────────────

// GET /api/transactions/:accountNumber  → list all transactions for an account
app.get(
  "/api/transactions/:accountNumber",
  authorize(["READ_TRANSACTION"]),
  async (req, res) => {
    try {
      const { accountNumber } = req.params;
      const transactions = await Transaction.find({ accountNumber })
        .sort({ date: -1 })
        .lean();
      res.json({ transactions });
    } catch (err) {
      console.error("GET /api/transactions error:", err);
      res.status(500).json({ error: "Failed to fetch transactions" });
    }
  },
);

// POST /api/transactions  → create a CREDIT or DEBIT transaction
app.post(
  "/api/transactions",
  authorize(["CREATE_TRANSACTION"]),
  async (req, res) => {
    try {
      const { accountNumber, amount, type } = req.body;

      const account = await Account.findOne({ accountNumber });
      if (!account)
        return res.status(404).json({ error: "Account not found" });

      const numericAmount = parseFloat(amount);
      if (type === "DEBIT") {
        if (account.balance < numericAmount)
          return res.status(400).json({ error: "Insufficient funds" });
        account.balance -= numericAmount;
      } else {
        account.balance += numericAmount;
      }

      const newTx = new Transaction({
        accountNumber,
        amount: numericAmount,
        type,
        date: new Date(),
      });

      // Persist both together
      await Promise.all([account.save(), newTx.save()]);

      res.status(201).json({
        message: "Transaction successful",
        transaction: newTx,
        newBalance: account.balance,
      });
    } catch (err) {
      console.error("POST /api/transactions error:", err);
      res.status(500).json({ error: "Failed to process transaction" });
    }
  },
);

// POST /api/loan  → process a loan disbursement
app.post("/api/loan", authorize(["CREATE_LOAN_TRANSACTION"]), async (req, res) => {
  try {
    const { accountNumber, expectedAmount } = req.body;

    const account = await Account.findOne({ accountNumber });
    if (!account) return res.status(404).json({ error: "Account not found" });

    const numericAmount = parseFloat(expectedAmount);
    account.balance += numericAmount;

    const tx = new Transaction({
      accountNumber,
      amount: numericAmount,
      type: "LOAN",
      description: "Loan disbursement",
      date: new Date(),
    });

    await Promise.all([account.save(), tx.save()]);

    res.status(201).json({
      message: "Loan processed successfully",
      transaction: tx,
      newBalance: account.balance,
    });
  } catch (err) {
    console.error("POST /api/loan error:", err);
    res.status(500).json({ error: "Failed to process loan" });
  }
});

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get("/health", (req, res) =>
  res.status(200).json({ status: "ok", service: "banking-service" }),
);

// ─── Bootstrap ────────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`Banking service running on port ${PORT}`);
  await connectDB();
  console.log("Banking service connected to MongoDB");
});
