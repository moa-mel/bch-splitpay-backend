export interface CreateGroupVaultInput {
  groupId: string;
  targetAmountBch: string;
  beneficiaryAddress: string;
}

export interface PreparedGroupVault {
  groupId: string;
  targetSatoshis: bigint;
  minerFeeSatoshis: bigint;
  requiredFundingSatoshis: bigint;
  beneficiaryAddress: string;
}

export const GROUP_VAULT_MINER_FEE = 1000n;

export function groupBchToSatoshis(amount: string): bigint {
  if (!/^\d+(\.\d{1,8})?$/.test(amount)) {
    throw new Error('Invalid BCH amount.');
  }

  const [whole, fraction = ''] = amount.split('.');

  const satoshis =
    BigInt(whole) * 100_000_000n +
    BigInt(fraction.padEnd(8, '0'));

  if (satoshis <= 0n) {
    throw new Error('Target amount must be greater than zero.');
  }

  return satoshis;
}

export function prepareGroupVault(
  input: CreateGroupVaultInput,
): PreparedGroupVault {
  if (!input.groupId?.trim()) {
    throw new Error('Group ID is required.');
  }

  if (!input.beneficiaryAddress?.trim()) {
    throw new Error('Beneficiary address is required.');
  }

  const targetSatoshis = groupBchToSatoshis(
    input.targetAmountBch,
  );

  return {
    groupId: input.groupId,
    targetSatoshis,
    minerFeeSatoshis: GROUP_VAULT_MINER_FEE,
    requiredFundingSatoshis:
      targetSatoshis + GROUP_VAULT_MINER_FEE,
    beneficiaryAddress: input.beneficiaryAddress,
  };
}