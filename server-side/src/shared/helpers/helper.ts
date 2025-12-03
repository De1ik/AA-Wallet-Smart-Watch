export function debugLog(msg?: string, ...optionalParams: any[]) {
  if (process.env.MODE === 'production') return;
  console.log("***".repeat(20));
  console.log(`[>DEBUG<]: ${msg}`, ...optionalParams);
  console.log("***".repeat(20));
}