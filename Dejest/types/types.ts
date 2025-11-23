export enum CallType {
  CALLTYPE_SINGLE = 0,
  CALLTYPE_BATCH = 1,
  CALLTYPE_DELEGATECALL = 2
}

export enum ParamCondition {
  EQUAL = 0,
  GREATER_THAN = 1,
  LESS_THAN = 2,
  GREATER_THAN_OR_EQUAL = 3,
  LESS_THAN_OR_EQUAL = 4,
  NOT_EQUAL = 5,
  ONE_OF = 6,
}

export interface ParamRule {
    condition: ParamCondition;
    offset: number;
    params: string[];
}

export interface Permission {
    callType: CallType;   
    target: string;   
    delegatedKey: string;
    selector: string;
    rules: ParamRule[];
}

export interface TokenLimit {
  enabled: boolean;
  txLimit: string;
  dailyLimit: string;
}

export interface TokenLimitEntry {
  token: string;
  limit: TokenLimit;
}

export interface PermissionTokenEntry {
    permission: Permission,
    tokenLimitEntry: TokenLimitEntry
}

export interface AllPermissionsPerDelegatedKey {
    delegatedKey: string;
    allowedTokens: string[];
    allowedRecipients: string[];
    tokenLimits: TokenLimitEntry[];
}

export interface RequestCreateDelegateKey {
    permissions: PermissionTokenEntry[]
}
