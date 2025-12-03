import { z } from "zod";

import { addressSchema } from "../../shared/validation/schema";

const hexStringSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]*$/, { message: "Must be a 0x-prefixed hex string" });

export const prepareSchema = z.object({
  to: addressSchema,
  amountWei: z.union([z.string(), z.number()]).transform((v) => BigInt(v.toString())),
  data: hexStringSchema.optional(),
  delegatedEOA: addressSchema,
  kernelAddress: addressSchema,
  tokenAddress: addressSchema.optional(),
});

export const broadcastSchema = z.object({
  to: addressSchema,
  amountWei: z.union([z.string(), z.number()]).transform((v) => BigInt(v.toString())),
  data: hexStringSchema.optional(),
  delegatedEOA: addressSchema,
  kernelAddress: addressSchema,
  tokenAddress: addressSchema.optional(),
  signature: hexStringSchema,
  opHash: hexStringSchema,
});

export const sendUopSchema = z.object({
  signature: hexStringSchema,
  unpacked: z.any(),
});
