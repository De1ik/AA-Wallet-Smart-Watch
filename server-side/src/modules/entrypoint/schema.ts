import { z } from "zod";

import { addressSchema, amountSchema } from "../../shared/validation/schema";

export const statusSchema = z.object({
  kernelAddress: addressSchema,
});

export const depositPrepareSchema = z.object({
  amountEth: amountSchema,
  kernelAddress: addressSchema,
});

export const depositExecuteSchema = z.object({
  unpacked: z.any(),
  signature: z.string().optional(),
});
