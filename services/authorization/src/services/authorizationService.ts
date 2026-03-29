import { prisma } from "@repo/db";
import {
  User,
  AuthorizationRequest,
  AuthorizationResponse,
  RolePermissions,
  PermissionCheck,
} from "../types";

class AuthorizationService {
  // Define role-based permissions
  private rolePermissions: RolePermissions = {
    USER: [
      "accounts:read",
      "transactions:read",
      "profile:read",
      "profile:update",
    ],
    ADMIN: [
      "accounts:read",
      "accounts:create",
      "accounts:update",
      "transactions:read",
      "transactions:create",
      "profile:read",
      "profile:update",
      "users:read",
      "users:create",
    ],
    SUPER_ADMIN: [
      "accounts:read",
      "accounts:create",
      "accounts:update",
      "accounts:delete",
      "transactions:read",
      "transactions:create",
      "transactions:update",
      "transactions:delete",
      "profile:read",
      "profile:update",
      "users:read",
      "users:create",
      "users:update",
      "users:delete",
      "roles:read",
      "roles:update",
    ],
  };

  // Role hierarchy for inheritance
  private roleHierarchy: { [key: string]: string[] } = {
    USER: ["USER"],
    ADMIN: ["USER", "ADMIN"],
    SUPER_ADMIN: ["USER", "ADMIN", "SUPER_ADMIN"],
  };

  async getUserById(userId: string): Promise<User | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
    };
  }

  getPermissionsForRole(role: string): string[] {
    const roles = this.roleHierarchy[role] || [role];
    const permissions: string[] = [];

    roles.forEach((userRole) => {
      const rolePermissions = this.rolePermissions[userRole] || [];
      rolePermissions.forEach((permission) => {
        if (!permissions.includes(permission)) {
          permissions.push(permission);
        }
      });
    });

    return permissions;
  }

  hasPermission(userRole: string, requiredPermission: string): boolean {
    const userPermissions = this.getPermissionsForRole(userRole);
    return userPermissions.includes(requiredPermission);
  }

  parsePermission(resource: string, action: string): string {
    return `${resource}:${action}`;
  }

  async checkAuthorization(
    data: AuthorizationRequest,
  ): Promise<AuthorizationResponse> {
    // Get user from database
    const user = await this.getUserById(data.userId);

    if (!user) {
      return {
        authorized: false,
        message: "User not found",
        user: { id: data.userId, email: "", role: "" },
        permissions: [],
      };
    }

    // Parse the required permission
    const requiredPermission = this.parsePermission(data.resource, data.action);

    // Check if user has the required permission
    const authorized = this.hasPermission(user.role, requiredPermission);

    // Get all user permissions for response
    const permissions = this.getPermissionsForRole(user.role);

    return {
      authorized,
      message: authorized
        ? `Access granted to ${data.action} ${data.resource}`
        : `Access denied to ${data.action} ${data.resource}`,
      user,
      permissions,
    };
  }

  async checkMultiplePermissions(
    userId: string,
    checks: PermissionCheck[],
  ): Promise<AuthorizationResponse[]> {
    const user = await this.getUserById(userId);

    if (!user) {
      return checks.map((check) => ({
        authorized: false,
        message: "User not found",
        user: { id: userId, email: "", role: "" },
        permissions: [],
      }));
    }

    const userPermissions = this.getPermissionsForRole(user.role);

    return checks.map((check) => {
      const requiredPermission = this.parsePermission(
        check.resource,
        check.action,
      );
      const authorized = userPermissions.includes(requiredPermission);

      return {
        authorized,
        message: authorized
          ? `Access granted to ${check.action} ${check.resource}`
          : `Access denied to ${check.action} ${check.resource}`,
        user,
        permissions: userPermissions,
      };
    });
  }

  getAvailableRoles(): string[] {
    return Object.keys(this.rolePermissions);
  }

  getRolePermissions(role: string): string[] {
    return this.rolePermissions[role] || [];
  }
}

export const authorizationService = new AuthorizationService();
