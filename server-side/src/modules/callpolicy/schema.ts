import { z } from "zod";

import { addressSchema } from "../../shared/validation/schema";
import { Hex } from "viem";

const bytes32Schema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, { message: "Invalid permission hash" })
  .transform((val) => val as Hex);

const nonNegativeIntSchema = z
  .number()
  .int()
  .nonnegative();

export const baseCallPolicySchema = z.object({
  owner: addressSchema,
  delegatedKey: addressSchema,
});

export const permissionIndexSchema = baseCallPolicySchema.extend({
  index: nonNegativeIntSchema,
});

export const permissionHashSchema = baseCallPolicySchema.extend({
  permissionHash: bytes32Schema,
});

export const tokenSchema = baseCallPolicySchema.extend({
  tokenAddress: addressSchema,
});

export const tokenUsageSchema = tokenSchema.extend({
  day: nonNegativeIntSchema.optional(),
});

export const recipientSchema = baseCallPolicySchema.extend({
  recipientAddress: addressSchema,
});
