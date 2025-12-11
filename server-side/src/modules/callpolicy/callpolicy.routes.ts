import type { Request, Response, Router } from "express";

import {
  handleCallPolicyDelegatedKeys,
  handleCallPolicyInfo,
  handleCallPolicyStatus,
  handlePermissionByHash,
  handlePermissionByIndex,
  handlePermissionsAll,
  handlePermissionsCount,
  handleRecipientIsAllowed,
  handleRecipientsAll,
  handleTokenLimit,
  handleTokensAll,
  handleTokenUsage,
  handleTokenUsageInfo,
} from "../callpolicy";

export function registerCallPolicyRoutes(router: Router): void {
  router.post("/callpolicy/info", async (req: Request, res: Response) => {
    const result = await handleCallPolicyInfo(req.body);
    return res.status(result.status).json(result.body);
  });

  router.post("/callpolicy/delegated-keys", async (req: Request, res: Response) => {
    const result = await handleCallPolicyDelegatedKeys(req.body);
    return res.status(result.status).json(result.body);
  });

  router.post("/callpolicy/status", async (req: Request, res: Response) => {
    const result = await handleCallPolicyStatus(req.body);
    return res.status(result.status).json(result.body);
  });

  router.post("/callpolicy/permissions-count", async (req: Request, res: Response) => {
    const result = await handlePermissionsCount(req.body);
    return res.status(result.status).json(result.body);
  });

  router.post("/callpolicy/permissions/all", async (req: Request, res: Response) => {
    const result = await handlePermissionsAll(req.body);
    return res.status(result.status).json(result.body);
  });

  router.post("/callpolicy/permissions/index", async (req: Request, res: Response) => {
    const result = await handlePermissionByIndex(req.body);
    return res.status(result.status).json(result.body);
  });

  router.post("/callpolicy/permission/hash", async (req: Request, res: Response) => {
    const result = await handlePermissionByHash(req.body);
    return res.status(result.status).json(result.body);
  });

  router.post("/callpolicy/token/all", async (req: Request, res: Response) => {
    const result = await handleTokensAll(req.body);
    return res.status(result.status).json(result.body);
  });

  router.post("/callpolicy/token/limit", async (req: Request, res: Response) => {
    const result = await handleTokenLimit(req.body);
    return res.status(result.status).json(result.body);
  });

  router.post("/callpolicy/token/usage", async (req: Request, res: Response) => {
    const result = await handleTokenUsage(req.body);
    return res.status(result.status).json(result.body);
  });

  router.post("/callpolicy/token/usage-info", async (req: Request, res: Response) => {
    const result = await handleTokenUsageInfo(req.body);
    return res.status(result.status).json(result.body);
  });

  router.post("/callpolicy/recipient/all", async (req: Request, res: Response) => {
    const result = await handleRecipientsAll(req.body);
    return res.status(result.status).json(result.body);
  });

  router.post("/callpolicy/recipient/is-allowed", async (req: Request, res: Response) => {
    const result = await handleRecipientIsAllowed(req.body);
    return res.status(result.status).json(result.body);
  });
}
