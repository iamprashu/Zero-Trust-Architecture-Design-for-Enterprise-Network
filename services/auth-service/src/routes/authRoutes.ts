import { Router, Request, Response } from "express";
import { authService } from "../services/authService";
import { authenticateToken } from "../middleware/authMiddleware";
import {
  CreateUserRequest,
  LoginRequest,
  AuthResponse,
  TokenVerificationResponse,
  RefreshTokenResponse,
} from "../types";

const router = Router();

router.post("/users", async (req: Request, res: Response): Promise<void> => {
  try {
    const data: CreateUserRequest = req.body;

    if (!data.email || !data.password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    const result: AuthResponse = await authService.createUser(data);
    res.json(result);
  } catch (error: any) {
    console.error("Error creating user:", error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post(
  "/auth/login",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const data: LoginRequest = req.body;

      if (!data.email || !data.password) {
        res.status(400).json({ error: "Email and password are required" });
        return;
      }

      const result: AuthResponse = await authService.loginUser(data);
      res.json(result);
    } catch (error: any) {
      console.error("Error during login:", error.message);
      res.status(500).json({ error: error.message });
    }
  },
);

router.post(
  "/auth/verify",
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { token } = req.body;

      if (!token) {
        res.status(400).json({ error: "Token is required" });
        return;
      }

      const result: TokenVerificationResponse =
        await authService.verifyToken(token);
      res.json(result);
    } catch (error: any) {
      console.error("Error verifying token:", error.message);
      res.status(500).json({ error: error.message });
    }
  },
);

router.post(
  "/auth/refresh",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(400).json({ error: "Refresh token is required" });
        return;
      }

      const result: RefreshTokenResponse =
        await authService.refreshToken(refreshToken);
      res.json(result);
    } catch (error: any) {
      console.error("Error refreshing token:", error.message);
      res.status(500).json({ error: error.message });
    }
  },
);

export default router;
