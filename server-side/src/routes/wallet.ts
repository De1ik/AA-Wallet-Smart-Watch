import { Router } from "express";

import { registerAccountRoutes } from "./wallet.accountRoutes";
import { registerCallPolicyRoutes } from "./wallet.callPolicyRoutes";
import { registerDelegatedRoutes } from "./wallet.delegatedRoutes";
import { registerEntryPointRoutes } from "./wallet.entryPointRoutes";
import { registerHealthRoutes } from "./wallet.healthRoutes";
import { registerUserOperationRoutes } from "./wallet.userOpRoutes";

const router = Router();

registerHealthRoutes(router);
registerUserOperationRoutes(router);
registerEntryPointRoutes(router);
registerCallPolicyRoutes(router);
registerDelegatedRoutes(router);
registerAccountRoutes(router);

export default router;
