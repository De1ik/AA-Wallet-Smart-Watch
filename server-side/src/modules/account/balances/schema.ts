import z from "zod";
import { addressSchema } from "../../../shared/validation/schema";

export const balancesSchema = z.object({
  address: addressSchema
});