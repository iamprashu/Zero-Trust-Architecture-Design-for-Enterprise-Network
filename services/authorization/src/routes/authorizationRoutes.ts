import { Router, Request, Response } from "express";
import { authorizationService } from "../services/authorizationService";
import {
  AuthorizationRequest,
  AuthorizationResponse,
  PermissionCheck,
} from "../types";

const router = Router();

// Single permission check endpoint
router.post(
  "/authorize",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const data: AuthorizationRequest = req.body;

      if (!data.userId || !data.resource || !data.action) {
        res.status(400).json({
          error: "userId, resource, and action are required",
        });
        return;
      }

      const result: AuthorizationResponse =
        await authorizationService.checkAuthorization(data);
      res.json(result);
    } catch (error: any) {
      console.error("Error during authorization:", error.message);
      res.status(500).json({ error: error.message });
    }
  },
);

// Multiple permission checks endpoint
router.post(
  "/authorize/batch",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId, checks }: { userId: string; checks: PermissionCheck[] } =
        req.body;

      if (!userId || !checks || !Array.isArray(checks)) {
        res.status(400).json({
          error: "userId and checks array are required",
        });
        return;
      }

      if (checks.length === 0) {
        res.status(400).json({
          error: "checks array cannot be empty",
        });
        return;
      }

      const results: AuthorizationResponse[] =
        await authorizationService.checkMultiplePermissions(userId, checks);
      res.json(results);
    } catch (error: any) {
      console.error("Error during batch authorization:", error.message);
      res.status(500).json({ error: error.message });
    }
  },
);

// Get user permissions endpoint
router.get(
  "/permissions/:userId",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;

      if (!userId) {
        res.status(400).json({
          error: "userId is required",
        });
        return;
      }

      const user = await authorizationService.getUserById(userId);

      if (!user) {
        res.status(404).json({
          error: "User not found",
        });
        return;
      }

      const permissions = authorizationService.getPermissionsForRole(user.role);

      res.json({
        user,
        permissions,
        message: `Retrieved permissions for user ${user.email}`,
      });
    } catch (error: any) {
      console.error("Error retrieving user permissions:", error.message);
      res.status(500).json({ error: error.message });
    }
  },
);

// Get available roles endpoint
router.get("/roles", async (req: Request, res: Response): Promise<void> => {
  try {
    const roles = authorizationService.getAvailableRoles();
    const roleDetails = roles.map((role) => ({
      role,
      permissions: authorizationService.getRolePermissions(role),
    }));

    res.json({
      roles: roleDetails,
      message: "Available roles and their permissions",
    });
  } catch (error: any) {
    console.error("Error retrieving roles:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
router.get("/health", async (req: Request, res: Response): Promise<void> => {
  res.json({
    status: "Authorization Service Running",
    timestamp: new Date().toISOString(),
  });
});

export default router;
