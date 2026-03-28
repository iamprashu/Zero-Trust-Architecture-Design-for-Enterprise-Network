export interface User {
  id: string;
  email: string;
  password: string;
}

export interface CreateUserRequest {
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface TokenPayload {
  userId: string;
  type: "access" | "refresh";
}

export interface AuthResponse {
  message: string;
  user: {
    id: string;
    email: string;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}

export interface TokenVerificationResponse {
  message: string;
  user: {
    id: string;
    email: string;
  };
  tokenData: {
    userId: string;
    type: string;
    expiresIn: number;
  };
}

export interface RefreshTokenResponse {
  message: string;
  tokens: {
    accessToken: string;
  };
}
