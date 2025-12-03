import { TOKEN_METADATA } from "../../utils/native-code";
export const findTokenMeta = (addr: string) =>
  TOKEN_METADATA.find((t) => t.address.toLowerCase() === addr.toLowerCase());
