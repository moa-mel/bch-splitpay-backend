
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  Contract,
  ElectrumNetworkProvider,
  TransactionBuilder,
} from 'cashscript';

import { cashAddressToLockingBytecode } from '@bitauth/libauth';

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

const splitArtifact = JSON.parse(
  readFileSync(
    path.join(root, 'contracts/artifacts/SplitRouter.json'),
    'utf8',
  ),
);

const groupArtifact = JSON.parse(
  readFileSync(
    path.join(root, 'contracts/artifacts/GroupVault.json'),
    'utf8',
  ),
);

const FEE = 1000n;

function addressHash(address) {
  const decoded = cashAddressToLockingBytecode(address);

  if (typeof decoded === 'string') {
    throw new Error(`Invalid BCH address: ${decoded}`);
  }

  if (decoded.prefix !== 'bchtest') {
    throw new Error('Only Chipnet BCH addresses are accepted.');
  }

  const bytecode = decoded.bytecode;

  // Standard P2PKH locking bytecode:
  // OP_DUP OP_HASH160 PUSH20 <hash> OP_EQUALVERIFY OP_CHECKSIG
  if (
    bytecode.length !== 25 ||
    bytecode[0] !== 0x76 ||
    bytecode[1] !== 0xa9 ||
    bytecode[2] !== 0x14 ||
    bytecode[23] !== 0x88 ||
    bytecode[24] !== 0xac
  ) {
    throw new Error('Recipient must use a standard P2PKH address.');
  }

  return bytecode.slice(3, 23);
}

function makeProvider() {
  return new ElectrumNetworkProvider('chipnet');
}

function makeSplitContract(provider, input) {
  const [first, second] = input.recipients;

  const args = [
    addressHash(first.address),
    BigInt(first.amountSatoshis),
    addressHash(second.address),
    BigInt(second.amountSatoshis),
  ];

  return new Contract(splitArtifact, args, { provider });
}

function makeGroupContract(provider, input) {
  return new Contract(
    groupArtifact,
    [
      addressHash(input.beneficiaryAddress),
      BigInt(input.targetSatoshis),
    ],
    { provider },
  );
}

async function prepareSplit(input) {
  const provider = makeProvider();
  const contract = makeSplitContract(provider, input);

  return {
    network: 'chipnet',
    contractAddress: contract.address,
    requiredFundingSatoshis: (
      BigInt(input.recipients[0].amountSatoshis) +
      BigInt(input.recipients[1].amountSatoshis) +
      FEE
    ).toString(),
  };
}

async function executeSplit(input) {
  const provider = makeProvider();
  const contract = makeSplitContract(provider, input);

  const utxos = await contract.getUtxos();

  if (utxos.length !== 1) {
    throw new Error(
      `SplitRouter requires exactly one funding UTXO. Found ${utxos.length}.`,
    );
  }

  const [first, second] = input.recipients;

  const expected =
    BigInt(first.amountSatoshis) +
    BigInt(second.amountSatoshis) +
    FEE;

  if (BigInt(utxos[0].satoshis) !== expected) {
    throw new Error(
      `Incorrect contract funding. Expected ${expected} satoshis.`,
    );
  }

  const result = await new TransactionBuilder({ provider })
    .addInput(utxos[0], contract.unlock.distribute())
    .addOutput({
      to: first.address,
      amount: BigInt(first.amountSatoshis),
    })
    .addOutput({
      to: second.address,
      amount: BigInt(second.amountSatoshis),
    })
    .send();

  return {
    network: 'chipnet',
    contractAddress: contract.address,
    transactionId: result.txid,
    transactionHex: result.hex,
    status: 'BROADCAST',
  };
}

async function prepareGroup(input) {
  const provider = makeProvider();
  const contract = makeGroupContract(provider, input);

  return {
    network: 'chipnet',
    contractAddress: contract.address,
  };
}

async function executeGroup(input) {
  const provider = makeProvider();
  const contract = makeGroupContract(provider, input);

  const utxos = await contract.getUtxos();

  if (utxos.length === 0) {
    throw new Error('GroupVault has no funding UTXOs.');
  }

  const total = utxos.reduce(
    (sum, utxo) => sum + BigInt(utxo.satoshis),
    0n,
  );

  const expected = BigInt(input.targetSatoshis) + FEE;

  if (total !== expected) {
    throw new Error(
      `GroupVault funding is ${total} satoshis; expected ${expected}.`,
    );
  }

  let builder = new TransactionBuilder({ provider });

  for (const utxo of utxos) {
    builder = builder.addInput(
      utxo,
      contract.unlock.settle(),
    );
  }

  builder = builder.addOutput({
    to: input.beneficiaryAddress,
    amount: BigInt(input.targetSatoshis),
  });

  const result = await builder.send();

  return {
    network: 'chipnet',
    contractAddress: contract.address,
    transactionId: result.txid,
    transactionHex: result.hex,
    status: 'BROADCAST',
  };
}

async function main() {
  let raw = '';

  for await (const chunk of process.stdin) {
    raw += chunk;
  }

  const request = JSON.parse(raw);

  let result;

  switch (request.action) {
    case 'prepare-split':
      result = await prepareSplit(request.input);
      break;

    case 'execute-split':
      result = await executeSplit(request.input);
      break;

    case 'prepare-group':
      result = await prepareGroup(request.input);
      break;

    case 'execute-group':
      result = await executeGroup(request.input);
      break;

    default:
      throw new Error('Unsupported CashScript worker action.');
  }

  process.stdout.write(JSON.stringify(result));
}

main().catch((error) => {
  process.stderr.write(error.stack || error.message);
  process.exitCode = 1;
});
