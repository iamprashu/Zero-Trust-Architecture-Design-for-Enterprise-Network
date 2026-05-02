import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import { createProxyMiddleware } from "http-proxy-middleware";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.get("/health", (req, res) => {
  res.json({ status: "API Gateway Running" });
});

app.use(
  "/auth",
  createProxyMiddleware({
    target: process.env.AUTH_SERVICE_URL || "http://localhost:5000",
    changeOrigin: true,
    pathRewrite: { "^/auth": "" },
  }),
);

app.use(
  "/users",
  createProxyMiddleware({
    target: process.env.USER_SERVICE_URL || "http://localhost:3002",
    changeOrigin: true,
    pathRewrite: { "^/users": "" },
  }),
);

app.use(
  "/authz",
  createProxyMiddleware({
    target: process.env.AUTHZ_SERVICE_URL || "http://localhost:3004",
    changeOrigin: true,
    pathRewrite: { "^/authz": "" },
  }),
);

app.use(
  "/devices",
  createProxyMiddleware({
    target: process.env.DEVICE_SERVICE_URL || "http://localhost:3005",
    changeOrigin: true,
    pathRewrite: { "^/devices": "" },
  }),
);

app.get("/", (req, res) => {
  res.send("Zero Trust API Gateway");
});

app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
});
