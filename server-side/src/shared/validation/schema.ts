import { z } from "zod";
import { Address, isAddress } from "viem";

export const addressSchema = z
  .string()
  .refine((addr) => isAddress(addr), {
    message: "Invalid Ethereum address",
  })
  .transform((val) => val as Address);

export const amountSchema = z
  .string()
  .transform((v) => parseFloat(v))
  .refine((v) => !isNaN(v), { message: "Amount must be a number" })
  .refine((v) => v > 0, { message: "Amount must be positive number" });

