import { Address } from "viem";

export interface BaseCallPolicyBody {
  owner: Address;
  delegatedKey: Address;
}

export interface PermissionIndexBody extends BaseCallPolicyBody {
  index: number;
}

export interface PermissionHashBody extends BaseCallPolicyBody {
  permissionHash: string;
}

export interface TokenBody extends BaseCallPolicyBody {
  tokenAddress: Address;
}

export interface TokenUsageBody extends TokenBody {
  day: number;
}

export interface RecipientBody extends BaseCallPolicyBody {
  recipientAddress: Address;
}

export interface PolicyInfo {
  delegatedKey: Address;
  policyId: string;
  status: number;
  statusText: string;
  isActive: boolean;
}
