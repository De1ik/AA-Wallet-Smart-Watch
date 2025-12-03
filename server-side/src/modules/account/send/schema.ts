import z from "zod";
import { addressSchema, amountSchema } from "../../../shared/validation/schema";

export const sendSchema = z.object({
  to: addressSchema,
  amount: amountSchema,
  tokenAddress: addressSchema.optional(),
  kernelAddress: addressSchema,
});