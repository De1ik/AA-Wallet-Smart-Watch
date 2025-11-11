import type { Request, Response, Router } from "express";

export function registerHealthRoutes(router: Router): void {
  router.get("/test", async (_req: Request, res: Response) => {
    res.json({ message: "Backend is alive" });
  });

  router.get("/health", async (_req: Request, res: Response) => {
    try {
      res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        message: "Server is running",
      });
    } catch (err: any) {
      res.status(500).json({
        status: "error",
        message: err?.message ?? "Health check failed",
      });
    }
  });
}
