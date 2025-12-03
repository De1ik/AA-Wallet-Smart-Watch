import type { Request, Response, Router } from "express";
import type { Address } from "viem";

import {
  handleBroadcast,
  handlePrepare,
  handleSendUop,
} from "./handlers";

export function registerUserOperationRoutes(router: Router): void {
  // Route to prepare a User Operation for delegated send (directly from smart watch)
  router.post("/userOp/prepare", async (req: Request, res: Response) => {
    const result = await handlePrepare(req.body);
    return res.status(result.status).json(result.body);
  });

  // Route to broadcast a prepared User Operation (directly from smart watch)
  router.post("/userOp/broadcast", async (req: Request, res: Response) => {
    const result = await handleBroadcast(req.body);
    return res.status(result.status).json(result.body);
  });

  router.post("/userOp/send-uop", async (req: Request, res: Response) => {
    const result = await handleSendUop(req.body);
    return res.status(result.status).json(result.body);
  });
}
