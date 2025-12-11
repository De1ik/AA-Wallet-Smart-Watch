import type { Request, Response, Router } from "express";
import { Address, parseEther } from "viem";

import {
  handleEntrypointStatus,
  handleExecuteEntrypointDeposit,
  handlePrepareEntrypointDeposit,
} from "./handlers";

export function registerEntryPointRoutes(router: Router): void {
  // Route to get current gas prices
  router.get("/entrypoint/status", async (req: Request, res: Response) => {
    const result = await handleEntrypointStatus({ ...req.query, ...req.body });
    return res.status(result.status).json(result.body);
  });

  router.post("/entrypoint/deposit/prepare-data", async (req: Request, res: Response) => {
    const result = await handlePrepareEntrypointDeposit(req.body);
    return res.status(result.status).json(result.body);
  });

  router.post("/entrypoint/deposit/execute", async (req: Request, res: Response) => {
    const result = await handleExecuteEntrypointDeposit(req.body);
    return res.status(result.status).json(result.body);
  });
}
