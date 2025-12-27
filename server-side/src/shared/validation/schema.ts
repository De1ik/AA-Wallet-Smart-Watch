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
  .trim()
  .refine((v) => v.length > 0, { message: "Amount must be provided" })
  .refine((v) => /^\d+(\.\d+)?$/.test(v), { message: "Amount must be a number" })
  .refine((v) => Number(v) > 0, { message: "Amount must be positive number" });
