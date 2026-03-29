import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "@repo/db";
import {
  User,
  CreateUserRequest,
  LoginRequest,
  AuthResponse,
  TokenVerificationResponse,
  RefreshTokenResponse,
} from "../types";

class AuthService {
  private generateAccessToken(userId: string): string {
    return jwt.sign(
      { userId, type: "access" },
      process.env.JWT_ACCESS_SECRET!,
      { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m" } as any,
    );
  }

  private generateRefreshToken(userId: string): string {
    return jwt.sign(
      { userId, type: "refresh" },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d" } as any,
    );
  }

  async createUser(data: CreateUserRequest): Promise<AuthResponse> {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new Error("User already exists");
    }

    // Validate role if provided
    let userRole = "USER";
    if (data.role) {
      const validRoles = ["USER", "ADMIN", "SUPER_ADMIN"];
      if (!validRoles.includes(data.role.toUpperCase())) {
        throw new Error("Invalid role provided");
      }
      userRole = data.role.toUpperCase();
    }

    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || "12");
    const hashedPassword = await bcrypt.hash(data.password, saltRounds);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        role: userRole,
      },
    });

    const accessToken = this.generateAccessToken(user.id);
    const refreshToken = this.generateRefreshToken(user.id);

    return {
      message: "User created successfully",
      user: {
        id: user.id,
        email: user.email,
      },
      tokens: {
        accessToken,
        refreshToken,
      },
    };
  }

  async loginUser(data: LoginRequest): Promise<AuthResponse> {
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      throw new Error("Invalid credentials");
    }

    const isPasswordValid = await bcrypt.compare(data.password, user.password);

    if (!isPasswordValid) {
      throw new Error("Invalid credentials");
    }

    const accessToken = this.generateAccessToken(user.id);
    const refreshToken = this.generateRefreshToken(user.id);

    return {
      message: "Login successful",
      user: {
        id: user.id,
        email: user.email,
      },
      tokens: {
        accessToken,
        refreshToken,
      },
    };
  }

  async verifyToken(token: string): Promise<TokenVerificationResponse> {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as any;

    if (decoded.type !== "access") {
      throw new Error("Invalid token type");
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    return {
      message: "Token is valid",
      user: {
        id: user.id,
        email: user.email,
      },
      tokenData: {
        userId: decoded.userId,
        type: decoded.type,
        expiresIn: decoded.exp,
      },
    };
  }

  async refreshToken(refreshToken: string): Promise<RefreshTokenResponse> {
    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET!,
    ) as any;

    if (decoded.type !== "refresh") {
      throw new Error("Invalid refresh token type");
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const newAccessToken = this.generateAccessToken(user.id);

    return {
      message: "Token refreshed successfully",
      tokens: {
        accessToken: newAccessToken,
      },
    };
  }
}

export const authService = new AuthService();
