import { Router } from "express";

import { registerAccountRoutes } from "../modules/account/account.routes";
import { registerCallPolicyRoutes } from "../modules/callpolicy/callpolicy.routes";
import { registerDelegatedRoutes } from "../modules/delegated/delegated.routes";
import { registerEntryPointRoutes } from "../modules/entrypoint/entrypoint.routes";
import { registerUserOperationRoutes } from "../modules/userop/userop.routes";

const router = Router();

registerUserOperationRoutes(router);
registerEntryPointRoutes(router);
registerCallPolicyRoutes(router);
registerDelegatedRoutes(router);
registerAccountRoutes(router);

export default router;
