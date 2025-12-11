import z from "zod";
import { addressSchema } from "../../../shared/validation/schema";

const useEtherscanSchema = z
  .union([z.string(), z.boolean(), z.number()])
  .optional()
  .transform((v): boolean => {
    if (v === undefined) return true;

    if (typeof v === "boolean") return v;

    if (typeof v === "number") return v === 1;

    const lowered = v.toLowerCase();
    if (lowered === "true" || lowered === "1") return true;
    if (lowered === "false" || lowered === "0") return false;

    throw new Error("useEtherscan must be true, false, 1, 0");
  });


const limitSchema = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v) => (v === undefined ? undefined : Number(v)))
  .refine((v) => v === undefined || Number.isFinite(v), {
    message: "limit must be a finite number",
  });


export const transactionsSchema = z.object({
  address: addressSchema,
  limit: limitSchema,
  useEtherscan: useEtherscanSchema,
});
