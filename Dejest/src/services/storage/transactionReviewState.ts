import { Address } from 'viem';

import { PermissionPolicyType, PrepareDataForSigning } from '@/domain/types';
import { CallPolicySettings } from '@/modules/delegated-keys/services/delegatedKeys';

export interface InstallReviewPayload {
  deviceId: string;
  deviceName: string;
  delegatedAddress: Address;
  kernelAddress: Address;
  clientId: string;
  permissionPolicyType: PermissionPolicyType;
  unsignedPermissionPolicyData: PrepareDataForSigning;
  unsignedGrantAccessData: PrepareDataForSigning;
  unsignedRecipientListData?: PrepareDataForSigning;
  unsignedTokenListData?: PrepareDataForSigning;
  installationId: string;
  callPolicySettingsSnapshot: CallPolicySettings;
}

export interface RevocationReviewPayload {
  deviceId?: string;
  deviceName?: string;
  delegatedAddress: Address;
  kernelAddress: Address;
  revocationId: string;
  unsignedRevokeData: PrepareDataForSigning;
  gasEstimateWei?: string;
}

export type TransactionReviewContext =
  | { kind: 'delegated-installation'; payload: InstallReviewPayload }
  | { kind: 'delegated-revocation'; payload: RevocationReviewPayload };

class TransactionReviewStateManager {
  private context: TransactionReviewContext | null = null;

  set(context: TransactionReviewContext) {
    this.context = context;
  }

  get(): TransactionReviewContext | null {
    return this.context;
  }

  clear() {
    this.context = null;
  }
}

export const transactionReviewState = new TransactionReviewStateManager();
