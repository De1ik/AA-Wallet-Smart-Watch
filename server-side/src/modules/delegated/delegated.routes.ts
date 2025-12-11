import type { Request, Response, Router } from "express";
import { handlePrepareDelegatedKeyCreation } from "./install/installPrepare";
import { handleExecuteDelegatedKeyCreation } from "./install/installExecute";
import { handlePrepareDelegatedKeyRevoke } from "./revoke/revokePrepare";
import { handleExecuteDelegatedKeyRevoke } from "./revoke/revokeExecute";
export function registerDelegatedRoutes(router: Router): void {
  // Route to create a delegated key with specified permissions (include full flow)
  router.post("/delegated/install/prepare-data", async (req: Request, res: Response) => {
    const result = await handlePrepareDelegatedKeyCreation(req.body);

    if (result.status === 200) {
      return res.json(result.body);
    }

    return res.status(result.status).json(result.body);
  });

  // Route to create a delegated key with specified permissions (include full flow)
  router.post("/delegated/install/execute", async (req: Request, res: Response) => {
    const result = await handleExecuteDelegatedKeyCreation(req.body);

    if (result.status === 200) {
      return res.json(result.body);
    }

    return res.status(result.status).json(result.body);
  });

  // Route to revoke a delegated key's access
  router.post("/delegated/revoke/prepare-data", async (req: Request, res: Response) => {
    const result = await handlePrepareDelegatedKeyRevoke(req.body);

    return res.status(result.status).json(result.body);
  });

  // Route to revoke a delegated key's access
  router.post("/delegated/revoke/execute", async (req: Request, res: Response) => {
    const result = await handleExecuteDelegatedKeyRevoke(req.body);

    return res.status(result.status).json(result.body);
  });
}
