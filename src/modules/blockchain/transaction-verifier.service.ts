
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
  HttpException,
  InternalServerErrorException,
} from '@nestjs/common';

import { NetworkProvider } from './network.provider';

interface InspectedTransaction {
  transactionId: string;
  confirmations: number;
  blockHeight: number | null;
  status: 'CONFIRMED' | 'UNCONFIRMED';
  confirmed: boolean;
}

interface TransactionOutput {
  lockingBytecode: Buffer;
  valueSatoshis: bigint;
}

const CASHADDR_CHARSET =
  'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

const CASHADDR_GENERATORS = [
  0x98f2bc8e61n,
  0x79b76d99e2n,
  0xf33e5fb3c4n,
  0xae2eabe2a8n,
  0x1e4f43e470n,
];

const CASHADDR_SIZE_BITS = [
  20, 24, 28, 32, 40, 48, 56, 64,
];

function cashAddressPolymod(values: number[]): bigint {
  let checksum = 1n;

  for (const value of values) {
    const top = checksum >> 35n;

    checksum =
      ((checksum & 0x07ffffffffn) << 5n) ^
      BigInt(value);

    for (let index = 0; index < 5; index += 1) {
      if (((top >> BigInt(index)) & 1n) !== 0n) {
        checksum ^= CASHADDR_GENERATORS[index];
      }
    }
  }

  return checksum;
}

function convertBits(
  values: number[],
  fromBits: number,
  toBits: number,
  pad: boolean,
): number[] {
  let accumulator = 0;
  let bitCount = 0;

  const result: number[] = [];
  const maxValue = (1 << toBits) - 1;
  const maxAccumulator =
    (1 << (fromBits + toBits - 1)) - 1;

  for (const value of values) {
    if (
      value < 0 ||
      (value >> fromBits) !== 0
    ) {
      throw new Error('Invalid CashAddress data.');
    }

    accumulator =
      ((accumulator << fromBits) | value) &
      maxAccumulator;

    bitCount += fromBits;

    while (bitCount >= toBits) {
      bitCount -= toBits;

      result.push(
        (accumulator >> bitCount) & maxValue,
      );
    }
  }

  if (pad) {
    if (bitCount > 0) {
      result.push(
        (accumulator << (toBits - bitCount)) &
          maxValue,
      );
    }
  } else if (
    bitCount >= fromBits ||
    ((accumulator << (toBits - bitCount)) &
      maxValue) !== 0
  ) {
    throw new Error('Invalid CashAddress padding.');
  }

  return result;
}

function cashAddressToLockingBytecode(
  address: string,
): Buffer {
  const separator = address.lastIndexOf(':');

  if (separator < 1) {
    throw new Error('CashAddress prefix is missing.');
  }

  const prefix = address.slice(0, separator).toLowerCase();
  const encoded = address.slice(separator + 1).toLowerCase();

  if (prefix !== 'bchtest') {
    throw new Error(
      'The address is not a BCH Chipnet CashAddress.',
    );
  }

  const values = [...encoded].map((character) => {
    const value = CASHADDR_CHARSET.indexOf(character);

    if (value === -1) {
      throw new Error('Invalid CashAddress character.');
    }

    return value;
  });

  if (values.length < 9) {
    throw new Error('CashAddress is too short.');
  }

  const prefixValues = [
    ...[...prefix].map(
      (character) => character.charCodeAt(0) & 31,
    ),
    0,
  ];

  if (
    cashAddressPolymod([
      ...prefixValues,
      ...values,
    ]) !== 1n
  ) {
    throw new Error('CashAddress checksum is invalid.');
  }

  const payload = convertBits(
    values.slice(0, -8),
    5,
    8,
    false,
  );

  if (payload.length < 2) {
    throw new Error('CashAddress payload is invalid.');
  }

  const version = payload[0];

  if ((version & 0x80) !== 0) {
    throw new Error('CashAddress version is invalid.');
  }

  const type = (version >> 3) & 0x0f;
  const sizeIndex = version & 7;

  const hash = Buffer.from(payload.slice(1));

  if (hash.length !== CASHADDR_SIZE_BITS[sizeIndex]) {
    throw new Error('CashAddress hash length is invalid.');
  }

  if (type === 0) {
    // Pay-to-public-key-hash (P2PKH).
    return Buffer.concat([
      Buffer.from([0x76, 0xa9, 0x14]),
      hash,
      Buffer.from([0x88, 0xac]),
    ]);
  }

  if (type === 1) {
    // Pay-to-script-hash (P2SH).
    return Buffer.concat([
      Buffer.from([0xa9, 0x14]),
      hash,
      Buffer.from([0x87]),
    ]);
  }

  throw new Error(
    `Unsupported CashAddress type: ${type}`,
  );
}

function readCompactSize(
  buffer: Buffer,
  state: { offset: number },
): bigint {
  if (state.offset >= buffer.length) {
    throw new Error('Unexpected end of transaction.');
  }

  const prefix = buffer[state.offset++];

  if (prefix < 0xfd) {
    return BigInt(prefix);
  }

  if (prefix === 0xfd) {
    if (state.offset + 2 > buffer.length) {
      throw new Error('Invalid transaction length.');
    }

    const value = buffer.readUInt16LE(state.offset);
    state.offset += 2;

    return BigInt(value);
  }

  if (prefix === 0xfe) {
    if (state.offset + 4 > buffer.length) {
      throw new Error('Invalid transaction length.');
    }

    const value = buffer.readUInt32LE(state.offset);
    state.offset += 4;

    return BigInt(value);
  }

  if (state.offset + 8 > buffer.length) {
    throw new Error('Invalid transaction length.');
  }

  const value = buffer.readBigUInt64LE(state.offset);
  state.offset += 8;

  return value;
}

function decodeTransactionOutputs(
  rawTransaction: string,
): TransactionOutput[] {
  const buffer = Buffer.from(rawTransaction, 'hex');

  if (buffer.length < 10) {
    throw new Error('Raw transaction is too short.');
  }

  const state = { offset: 0 };

  // Version.
  state.offset += 4;

  // SegWit marker and flag, if present.
  let hasWitness = false;

  if (
    buffer[state.offset] === 0x00 &&
    buffer[state.offset + 1] !== 0x00
  ) {
    hasWitness = true;
    state.offset += 2;
  }

  // Inputs.
  const inputCount = readCompactSize(buffer, state);

  if (inputCount > BigInt(buffer.length)) {
    throw new Error('Invalid transaction input count.');
  }

  for (
    let index = 0n;
    index < inputCount;
    index += 1n
  ) {
    // Previous transaction hash and output index.
    state.offset += 36;

    const scriptLength = Number(
      readCompactSize(buffer, state),
    );

    state.offset += scriptLength;

    // Sequence.
    state.offset += 4;

    if (state.offset > buffer.length) {
      throw new Error('Invalid transaction input.');
    }
  }

  // Outputs.
  const outputCount = readCompactSize(buffer, state);

  if (outputCount > BigInt(buffer.length)) {
    throw new Error('Invalid transaction output count.');
  }

  const outputs: TransactionOutput[] = [];

  for (
    let index = 0n;
    index < outputCount;
    index += 1n
  ) {
    if (state.offset + 8 > buffer.length) {
      throw new Error('Invalid transaction output value.');
    }

    const valueSatoshis =
      buffer.readBigUInt64LE(state.offset);

    state.offset += 8;

    const scriptLength = Number(
      readCompactSize(buffer, state),
    );

    if (
      !Number.isSafeInteger(scriptLength) ||
      scriptLength < 0 ||
      state.offset + scriptLength > buffer.length
    ) {
      throw new Error('Invalid transaction output script.');
    }

    const lockingBytecode = buffer.subarray(
      state.offset,
      state.offset + scriptLength,
    );

    state.offset += scriptLength;

    outputs.push({
      lockingBytecode,
      valueSatoshis,
    });
  }

  // Skip witness data after outputs.
  if (hasWitness) {
    for (
      let index = 0n;
      index < inputCount;
      index += 1n
    ) {
      const itemCount = readCompactSize(buffer, state);

      for (
        let item = 0n;
        item < itemCount;
        item += 1n
      ) {
        const itemLength = Number(
          readCompactSize(buffer, state),
        );

        state.offset += itemLength;

        if (state.offset > buffer.length) {
          throw new Error('Invalid transaction witness.');
        }
      }
    }
  }

  // Four-byte locktime must remain.
  if (state.offset + 4 !== buffer.length) {
    throw new Error('Transaction structure is invalid.');
  }

  return outputs;
}

function equalBytes(
  left: Buffer,
  right: Buffer,
): boolean {
  return left.equals(right);
}

@Injectable()
export class TransactionVerifierService {
  constructor(
    private readonly networkProvider: NetworkProvider,
  ) {}

  private validateTransactionId(transactionId: string) {
    if (!/^[a-fA-F0-9]{64}$/.test(transactionId)) {
      throw new BadRequestException(
        'A valid 64-character transaction ID is required.',
      );
    }
  }

  private async inspectTransaction(
    transactionId: string,
  ): Promise<{
    transaction: InspectedTransaction;
    outputs: TransactionOutput[];
  }> {
    this.validateTransactionId(transactionId);

    let rawTransaction: string;

    try {
      rawTransaction =
        await this.networkProvider.call<string>(
          'getrawtransaction',
          [transactionId, false],
        );
    } catch (error) {
      if (error instanceof HttpException) {
        const message = error.message.toLowerCase();

        if (
          message.includes('not found') ||
          message.includes('no such') ||
          message.includes('unknown transaction')
        ) {
          throw new NotFoundException(
            'Transaction was not found on BCH Chipnet.',
          );
        }

        throw error;
      }

      throw new ServiceUnavailableException(
        'Unable to retrieve the transaction from BCH Chipnet.',
      );
    }

    if (
      typeof rawTransaction !== 'string' ||
      !/^(?:[a-fA-F0-9]{2})+$/.test(rawTransaction)
    ) {
      throw new ServiceUnavailableException(
        'Electrum did not return valid raw transaction hex.',
      );
    }

    let outputs: TransactionOutput[];

    try {
      outputs = decodeTransactionOutputs(rawTransaction);
    } catch (error) {
      throw new InternalServerErrorException(
        `Unable to decode BCH transaction outputs: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }

    let transactionHeight: number | null;
    let tipHeight: number;

    try {
      transactionHeight =
        await this.networkProvider.call<number | null>(
          'gettransactionheight',
          [transactionId],
        );

      tipHeight =
        await this.networkProvider.call<number>(
          'gettipheight',
        );
    } catch {
      throw new ServiceUnavailableException(
        'Unable to retrieve BCH confirmation data.',
      );
    }

    if (
      transactionHeight === null ||
      transactionHeight < 0
    ) {
      throw new NotFoundException(
        'Transaction is not known to the BCH network.',
      );
    }

    const confirmations =
      transactionHeight > 0
        ? Math.max(0, tipHeight - transactionHeight + 1)
        : 0;

    const confirmed = confirmations > 0;

    return {
      transaction: {
        transactionId,
        confirmations,
        blockHeight:
          transactionHeight > 0
            ? transactionHeight
            : null,
        status: confirmed ? 'CONFIRMED' : 'UNCONFIRMED',
        confirmed,
      },
      outputs,
    };
  }

  async verify(transactionId: string) {
    const result = await this.inspectTransaction(
      transactionId,
    );

    return {
      ...result.transaction,
      network: this.networkProvider.getNetwork(),
      found: true,
    };
  }

  async verifyPaymentOutput(
    transactionId: string,
    expectedAddress: string,
    expectedSatoshis: bigint,
  ) {
    if (expectedSatoshis <= 0n) {
      throw new BadRequestException(
        'Expected payment amount must be greater than zero.',
      );
    }

    let expectedBytecode: Buffer;

    try {
      expectedBytecode =
        cashAddressToLockingBytecode(expectedAddress);
    } catch (error) {
      throw new BadRequestException(
        `Invalid GroupVault CashAddress: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }

    const inspected = await this.inspectTransaction(
      transactionId,
    );

    const paidSatoshis = inspected.outputs.reduce(
      (total, output) => {
        return equalBytes(
          output.lockingBytecode,
          expectedBytecode,
        )
          ? total + output.valueSatoshis
          : total;
      },
      0n,
    );

    return {
      ...inspected.transaction,
      network: this.networkProvider.getNetwork(),
      found: true,
      expectedSatoshis: expectedSatoshis.toString(),
      paidSatoshis: paidSatoshis.toString(),
      paymentMatches:
        paidSatoshis === expectedSatoshis,
    };
  }
}
