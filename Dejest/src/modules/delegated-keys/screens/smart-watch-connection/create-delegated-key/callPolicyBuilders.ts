import { CallPolicyPermission, CallPolicySettings, TokenSelection } from '@/modules/delegated-keys/services/delegatedKeys';
import { PermissionPolicyType, PermissionTokenEntry } from '@/domain/types';

export type TransferOptions = { eth: boolean; erc20: boolean };

export function generateCallPolicyPermissions(
  delegatedKey: string,
  callPolicySettings: CallPolicySettings,
  transferOptions: TransferOptions,
  transferEnabled: boolean,
  predefinedActions: { id: string; selector: string }[]
): CallPolicyPermission[] {
  const permissions: CallPolicyPermission[] = [];
  const hasTransferAction = callPolicySettings.allowedActions.includes('transfer') && transferEnabled;

  if (hasTransferAction && transferOptions.eth) {
    callPolicySettings.allowedTargets.forEach((target) => {
      permissions.push({
        callType: 0,
        target: target.address,
        delegatedKey,
        selector: '0x00000000',
        rules: [],
        decimals: 18,
        valueLimit: callPolicySettings.maxValuePerTx,
        dailyLimit: callPolicySettings.maxValuePerDay,
      });
    });
  }

  if (hasTransferAction && transferOptions.erc20) {
    callPolicySettings.allowedTokens.forEach((token) => {
      permissions.push({
        callType: 0,
        target: token.address,
        delegatedKey,
        selector: '0xa9059cbb',
        rules: [],
        decimals: token.decimals,
        tokenSymbol: token.symbol,
        valueLimit: token.maxValuePerTx,
        dailyLimit: token.maxValuePerDay,
      });
    });
  }

  callPolicySettings.allowedTargets.forEach((target) => {
    callPolicySettings.allowedActions
      .filter((actionId) => actionId !== 'transfer')
      .forEach((actionId) => {
        const action = predefinedActions.find((a) => a.id === actionId);
        if (!action) return;
        permissions.push({
          callType: 0,
          target: target.address,
          delegatedKey,
          selector: action.selector,
          rules: [],
          decimals: 18,
          valueLimit: callPolicySettings.maxValuePerTx,
          dailyLimit: callPolicySettings.maxValuePerDay,
        });
      });
  });

  return permissions;
}

export function buildPermissionTokenEntries(
  delegatedKey: string,
  callPolicySettings: CallPolicySettings,
  transferOptions: TransferOptions,
  transferEnabled: boolean,
  predefinedActions: { id: string; selector: string }[]
): PermissionTokenEntry[] {
  const zeroAddress = '0x0000000000000000000000000000000000000000';
  const entries: PermissionTokenEntry[] = [];
  const hasTransferAction = callPolicySettings.allowedActions.includes('transfer') && transferEnabled;

  if (hasTransferAction && transferOptions.eth) {
    callPolicySettings.allowedTargets.forEach((target) => {
      entries.push({
        permission: {
          callType: 0,
          target: target.address,
          delegatedKey,
          selector: '0x00000000',
          rules: [],
        },
        tokenLimitEntry: {
          token: zeroAddress,
          limit: {
            enabled: true,
            txLimit: callPolicySettings.maxValuePerTx,
            dailyLimit: callPolicySettings.maxValuePerDay,
          },
        },
      });
    });
  }

  if (hasTransferAction && transferOptions.erc20) {
    callPolicySettings.allowedTokens.forEach((token: TokenSelection) => {
      entries.push({
        permission: {
          callType: 0,
          target: token.address,
          delegatedKey,
          selector: '0xa9059cbb',
          rules: [],
        },
        tokenLimitEntry: {
          token: token.address,
          limit: {
            enabled: true,
            txLimit: token.maxValuePerTx,
            dailyLimit: token.maxValuePerDay,
          },
        },
      });
    });
  }

  callPolicySettings.allowedTargets.forEach((target) => {
    callPolicySettings.allowedActions
      .filter((actionId) => actionId !== 'transfer')
      .forEach((actionId) => {
        const action = predefinedActions.find((a) => a.id === actionId);
        if (!action) return;
        entries.push({
          permission: {
            callType: 0,
            target: target.address,
            delegatedKey,
            selector: action.selector,
            rules: [],
          },
          tokenLimitEntry: {
            token: zeroAddress,
            limit: {
              enabled: false,
              txLimit: '0',
              dailyLimit: '0',
            },
          },
        });
      });
  });

  return entries;
}

export function logCallPolicyDebug(
  keyType: PermissionPolicyType,
  callPolicySettings: CallPolicySettings,
  transferOptions: TransferOptions,
  transferEnabled: boolean,
  permissions: CallPolicyPermission[],
  predefinedActions: { id: string; name: string; selector: string; description: string }[]
): void {
  console.log('\n📱 ===== CLIENT: CALLPOLICY RESTRICTIONS =====');
  console.log(`🔑 Key Type: ${keyType}`);
  console.log(`💰 Max Value Per Transaction: ${callPolicySettings.maxValuePerTx} ETH`);
  console.log(`📅 Max Value Per Day: ${callPolicySettings.maxValuePerDay} ETH`);
  console.log('\n🎯 ALLOWED TARGET ADDRESSES:');
  callPolicySettings.allowedTargets.forEach((target, index) => {
    console.log(`   ${index + 1}. ${target.name} (${target.address})`);
  });
  console.log('\n🪙 ALLOWED TOKENS FOR ERC20 TRANSFERS:');
  callPolicySettings.allowedTokens.forEach((token, index) => {
    console.log(`   ${index + 1}. ${token.symbol} (${token.address}) dec:${token.decimals}`);
  });
  console.log('\n⚡ ALLOWED ACTIONS:');
  callPolicySettings.allowedActions.forEach((actionId, index) => {
    if (actionId === 'transfer') {
      console.log(`   ${index + 1}. Transfer - ${transferEnabled ? 'ENABLED' : 'DISABLED'}`);
      if (transferEnabled) {
        console.log(`      Transfer Options:`);
        if (transferOptions.eth) {
          console.log(`      - ETH Transfers (0x00000000)`);
        }
        if (transferOptions.erc20) {
          console.log(`      - ERC20 Token Transfers (0xa9059cbb)`);
        }
      }
    } else {
      const action = predefinedActions.find((a) => a.id === actionId);
      if (action) {
        console.log(`   ${index + 1}. ${action.name} (${action.selector}) - ${action.description}`);
      }
    }
  });
  console.log('\n🔐 GENERATED PERMISSIONS:');
  permissions.forEach((perm, index) => {
    let actionName = 'Unknown';
    if (perm.selector === '0x00000000') {
      actionName = 'ETH Transfer';
    } else if (perm.selector === '0xa9059cbb') {
      actionName = 'ERC20 Transfer';
    } else {
      const action = predefinedActions.find((a) => a.selector === perm.selector);
      actionName = action ? action.name : 'Unknown';
    }
    console.log(`   ${index + 1}. ${actionName}`);
    console.log(`      Target: ${perm.target}`);
    console.log(`      Selector: ${perm.selector}`);
    console.log(`      Value Limit: ${perm.valueLimit} ETH`);
    console.log(`      Daily Limit: ${perm.dailyLimit} ETH`);
    console.log(`      Rules: ${perm.rules.length > 0 ? JSON.stringify(perm.rules, null, 8) : 'None'}`);
    console.log('');
  });
  console.log('📱 ===========================================\n');
}
