/**
 * Integration boundary only.
 *
 * Implement this interface against the exact XO Engine/template versions
 * verified from the official developer wallet. Do not treat these methods as
 * implemented until they construct/execute real XO actions and are tested.
 */
export interface XoInvitation {
  id: string;
  encoded: string;
}

export interface XoTransactionResult {
  transactionId: string;
  broadcast: boolean;
}

export interface XoAdapter {
  createSplitRouterInvitation(input: {
    totalSatoshis: bigint;
    recipients: Array<{ address: string; amountSatoshis: bigint }>;
  }): Promise<XoInvitation>;

  createGroupVaultInvitation(input: {
    targetSatoshis: bigint;
    contributors: string[];
  }): Promise<XoInvitation>;

  executeInvitation(invitation: XoInvitation): Promise<XoTransactionResult>;
}
