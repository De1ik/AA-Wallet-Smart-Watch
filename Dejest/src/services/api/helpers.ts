import { InstallPrepareSuccess } from "@/domain/types";
import { ErrorResponse, executedEntryPointDeposit, prepareEntryPointDeposit } from "./apiTypes";
import { validateAndSign } from "@/services/blockchain/signUOp";

export function isInstallPrepareSuccess(
  result: InstallPrepareSuccess | ErrorResponse
): result is InstallPrepareSuccess {
  return result.success === true;
}

export function isDepositPrepareSuccess(
  result: prepareEntryPointDeposit | ErrorResponse
): result is prepareEntryPointDeposit {
  return result.success === true;
}

export function isDepositExecuteSuccess(
  result: executedEntryPointDeposit | ErrorResponse
): result is executedEntryPointDeposit {
  return result.success === true;
}



export function debugLog(msg?: string, ...optionalParams: any[]) {
    console.log("***".repeat(20));
    console.log(`[API-CLIENT-DEBUG]: ${msg}`, ...optionalParams);
    console.log("***".repeat(20));
}