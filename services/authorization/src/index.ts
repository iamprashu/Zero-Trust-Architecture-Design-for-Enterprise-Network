import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import authorizationRoutes from "./routes/authorizationRoutes";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3004;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "Authorization Service Running" });
});

// Mount authorization routes
app.use("/authz", authorizationRoutes);

app.get("/", (req, res) => {
  res.send("Zero Trust Authorization Service");
});

app.listen(PORT, () => {
  console.log(`Authorization Service running on port ${PORT}`);
});
