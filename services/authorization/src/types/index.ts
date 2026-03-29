export interface User {
  id: string;
  email: string;
  role: string;
}

export interface AuthorizationRequest {
  userId: string;
  resource: string;
  action: string;
}

export interface AuthorizationResponse {
  authorized: boolean;
  message: string;
  user: User;
  permissions: string[];
}

export interface RolePermissions {
  [key: string]: string[];
}

export interface PermissionCheck {
  resource: string;
  action: string;
  allowed: boolean;
}
