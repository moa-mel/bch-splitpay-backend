export interface SplitRecipient {
  name: string;
  address: string;
  amountBch: string;
}

export interface CreateSplitRouterInput {
  recipients: SplitRecipient[];
}

export interface PreparedSplitRouter {
  recipients: Array<{
    name: string;
    address: string;
    amountSatoshis: bigint;
  }>;
  totalSatoshis: bigint;
  minerFeeSatoshis: bigint;
  requiredFundingSatoshis: bigint;
}

export const SPLIT_ROUTER_MINER_FEE = 1000n;
export const SPLIT_ROUTER_MINIMUM_OUTPUT = 546n;

export function bchToSatoshis(amount: string): bigint {
  if (!/^\d+(\.\d{1,8})?$/.test(amount)) {
    throw new Error('Invalid BCH amount.');
  }

  const [whole, fraction = ''] = amount.split('.');

  const satoshis =
    BigInt(whole) * 100_000_000n +
    BigInt(fraction.padEnd(8, '0'));

  if (satoshis <= 0n) {
    throw new Error('Amount must be greater than zero.');
  }

  return satoshis;
}

export function prepareSplitRouter(
  input: CreateSplitRouterInput,
): PreparedSplitRouter {
  if (!input.recipients || input.recipients.length !== 2) {
    throw new Error(
      'The initial SplitRouter implementation supports exactly two recipients.',
    );
  }

  const recipients = input.recipients.map((recipient) => {
    if (!recipient.name?.trim()) {
      throw new Error('Recipient name is required.');
    }

    if (!recipient.address?.trim()) {
      throw new Error('Recipient address is required.');
    }

    const amountSatoshis = bchToSatoshis(recipient.amountBch);

    if (amountSatoshis <= SPLIT_ROUTER_MINIMUM_OUTPUT) {
      throw new Error(
        'Each recipient amount must exceed 546 satoshis.',
      );
    }

    return {
      name: recipient.name.trim(),
      address: recipient.address.trim(),
      amountSatoshis,
    };
  });

  if (recipients[0].address === recipients[1].address) {
    throw new Error('Recipients must have different addresses.');
  }

  const totalSatoshis = recipients.reduce(
    (total, recipient) => total + recipient.amountSatoshis,
    0n,
  );

  return {
    recipients,
    totalSatoshis,
    minerFeeSatoshis: SPLIT_ROUTER_MINER_FEE,
    requiredFundingSatoshis:
      totalSatoshis + SPLIT_ROUTER_MINER_FEE,
  };
}