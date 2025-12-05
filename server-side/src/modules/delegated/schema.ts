import { z } from "zod";

import { addressSchema } from "../../shared/validation/schema";
import { PermissionPolicyType } from "../../utils/native/types";

export const installPrepareSchema = z.object({
  delegatedAddress: addressSchema,
  keyType: z.nativeEnum(PermissionPolicyType),
  clientId: z.string(),
  kernelAddress: addressSchema,
  permissions: z.any(),
  callPolicyConfig: z.any().optional(),
});

export const installExecuteSchema = z.object({
  data: z.object({
    signedPermissionPolicyData: z.any(),
    signedGrantAccessData: z.any(),
    signedRecipientListData: z.any().optional(),
    signedTokenListData: z.any().optional(),
    permissionPolicyType: z.nativeEnum(PermissionPolicyType),
  }),
  clientId: z.string().optional(),
  kernelAddress: addressSchema,
  installationId: z.string(),
});

export const revokePrepareSchema = z.object({
  delegatedEOA: addressSchema,
  kernelAddress: addressSchema,
});

export const revokeExecuteSchema = z.object({
  revocationId: z.string(),
  delegatedEOA: addressSchema,
  kernelAddress: addressSchema,
  data: z.object({
    signedRevokeData: z.any(),
  }),
});
