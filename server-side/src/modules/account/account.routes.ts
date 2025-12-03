import type { Request, Response, Router } from "express";

import {
  handleGetBalances,
  handleGetTransactions,
  handleSend,
} from ".";



export function registerAccountRoutes(router: Router): void {
  router.get("/balances", async (req: Request, res: Response) => {
    const result = await handleGetBalances(req.query);
    return res.status(result.status).json(result.body);
  });

  router.get("/transactions", async (req: Request, res: Response) => {
    const result = await handleGetTransactions(req.query);
    return res.status(result.status).json(result.body);
  });

  router.post("/send", async (req: Request, res: Response) => {
    const result = await handleSend(req.body);
    return res.status(result.status).json(result.body);
  });
}
