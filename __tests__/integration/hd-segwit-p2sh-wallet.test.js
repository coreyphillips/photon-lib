import * as bitcoin from 'bitcoinjs-lib';
import assert from 'assert';
import { ElectrumClient as BlueElectrum, HDSegwitP2SHWallet, BitcoinUnit } from '../../';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 300 * 1000;

beforeAll(async () => {
  try {
    await BlueElectrum.connectMain();
    await BlueElectrum.waitTillConnected();
  } catch (Err) {
    console.log('failed to connect to Electrum:', Err);
    process.exit(2);
  }
});

afterAll(() => {
  BlueElectrum.forceDisconnect();
});

it('HD (BIP49) can work with a gap', async function() {
  let hd = new HDSegwitP2SHWallet();
  hd._xpub = 'ypub6XRzrn3HB1tjhhvrHbk1vnXCecZEdXohGzCk3GXwwbDoJ3VBzZ34jNGWbC6WrS7idXrYjjXEzcPDX5VqnHEnuNf5VAXgLfSaytMkJ2rwVqy'; // has gap
  await hd.fetchBalance();

  // for (let c = 0; c < 5; c++) {
  //   console.log('internal', c, hd._getInternalAddressByIndex(c));
  // }

  // for (let c = 0; c < 5; c++) {
  //   console.log('external', c, hd._getExternalAddressByIndex(c));
  // }
  await hd.fetchTransactions();
  assert.ok(hd.getTransactions().length >= 3);
});

it('Segwit HD (BIP49) can fetch more data if pointers to last_used_addr are lagging behind', async function() {
  let hd = new HDSegwitP2SHWallet();
  hd._xpub = 'ypub6WZ2c7YJ1SQ1rBYftwMqwV9bBmybXzETFxWmkzMz25bCf6FkDdXjNgR7zRW8JGSnoddNdUH7ZQS7JeQAddxdGpwgPskcsXFcvSn1JdGVcPQ';
  hd.next_free_change_address_index = 40;
  hd.next_free_address_index = 50;
  await hd.fetchBalance();
  await hd.fetchTransactions();
  assert.strictEqual(hd.getTransactions().length, 153);
});

it('HD (BIP49) can create TX', async () => {
  if (!process.env.HD_MNEMONIC_BIP49) {
    console.error('process.env.HD_MNEMONIC_BIP49 not set, skipped');
    return;
  }
  let hd = new HDSegwitP2SHWallet();
  hd.setSecret(process.env.HD_MNEMONIC_BIP49);
  assert.ok(hd.validateMnemonic());

  await hd.fetchBalance();
  await hd.fetchUtxo();
  assert.ok(typeof hd.utxo[0].confirmations === 'number');
  assert.ok(hd.utxo[0].txid);
  assert.ok(hd.utxo[0].vout !== undefined);
  assert.ok(hd.utxo[0].amount);
  assert.ok(hd.utxo[0].address);
  assert.ok(hd.utxo[0].wif);
  let txhex = hd.createTx(hd.utxo, 0.000014, 0.000001, '3GcKN7q7gZuZ8eHygAhHrvPa5zZbG5Q1rK');
  assert.strictEqual(
    txhex,
    '0100000000010187c9acd9d5714845343b18abaa26cb83299be2487c22da9c0e270f241b4d9cfe0000000017160014a239b6a0cbc7aadc2e77643de36306a6167fad15ffffffff02780500000000000017a914a3a65daca3064280ae072b9d6773c027b30abace87b45f00000000000017a9140acff2c37ed45110baece4bb9d4dcc0c6309dbbd8702483045022100f489dfbd372b66348a25f6e9ba1b5eb88a3646efcd75ef1211c96cf46eed692c0220416ac99a94c5f4a076588291d9857fc5b854e02404d69635dc35e82fde3ecd9701210202ac3bd159e54dc31e65842ad5f9a10b4eb024e83864a319b27de65ee08b2a3900000000',
  );

  txhex = hd.createTx(hd.utxo, 0.000005, 0.000001, '3GcKN7q7gZuZ8eHygAhHrvPa5zZbG5Q1rK');
  var tx = bitcoin.Transaction.fromHex(txhex);
  assert.strictEqual(tx.ins.length, 1);
  assert.strictEqual(tx.outs.length, 2);
  assert.strictEqual(tx.outs[0].value, 500);
  assert.strictEqual(tx.outs[1].value, 25400);
  let toAddress = bitcoin.address.fromOutputScript(tx.outs[0].script);
  let changeAddress = bitcoin.address.fromOutputScript(tx.outs[1].script);
  assert.strictEqual('3GcKN7q7gZuZ8eHygAhHrvPa5zZbG5Q1rK', toAddress);
  assert.strictEqual(hd._getInternalAddressByIndex(hd.next_free_change_address_index), changeAddress);

  //

  txhex = hd.createTx(hd.utxo, 0.000015, 0.000001, '3GcKN7q7gZuZ8eHygAhHrvPa5zZbG5Q1rK');
  tx = bitcoin.Transaction.fromHex(txhex);
  assert.strictEqual(tx.ins.length, 1);
  assert.strictEqual(tx.outs.length, 2);

  //

  txhex = hd.createTx(hd.utxo, 0.00025, 0.00001, '3GcKN7q7gZuZ8eHygAhHrvPa5zZbG5Q1rK');
  tx = bitcoin.Transaction.fromHex(txhex);
  assert.strictEqual(tx.ins.length, 1);
  assert.strictEqual(tx.outs.length, 1);
  toAddress = bitcoin.address.fromOutputScript(tx.outs[0].script);
  assert.strictEqual('3GcKN7q7gZuZ8eHygAhHrvPa5zZbG5Q1rK', toAddress);

  // testing sendMAX
  hd.utxo = [
    {
      txid: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      vout: 0,
      amount: 26000,
      address: '39SpCj47M88ajRBTbkfaKRgpaX7FTLQJz5',
      wif: 'L3fg5Jb6tJDVMvoG2boP4u3CxjX1Er3e7Z4zDALQdGgVLLE8zVUr',
    },
    {
      txid: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      vout: 0,
      amount: 26000,
      address: '39SpCj47M88ajRBTbkfaKRgpaX7FTLQJz5',
      wif: 'L3fg5Jb6tJDVMvoG2boP4u3CxjX1Er3e7Z4zDALQdGgVLLE8zVUr',
    },
    {
      txid: 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      vout: 0,
      amount: 26000,
      address: '39SpCj47M88ajRBTbkfaKRgpaX7FTLQJz5',
      wif: 'L3fg5Jb6tJDVMvoG2boP4u3CxjX1Er3e7Z4zDALQdGgVLLE8zVUr',
    },
  ];
  txhex = hd.createTx(hd.utxo, BitcoinUnit.MAX, 0.00003, '3GcKN7q7gZuZ8eHygAhHrvPa5zZbG5Q1rK');
  tx = bitcoin.Transaction.fromHex(txhex);
  assert.strictEqual(tx.outs.length, 1);
  assert.strictEqual(tx.outs[0].value, 75000);
});

it('Segwit HD (BIP49) can fetch balance with many used addresses in hierarchy', async function() {
  if (!process.env.HD_MNEMONIC_BIP49_MANY_TX) {
    console.error('process.env.HD_MNEMONIC_BIP49_MANY_TX not set, skipped');
    return;
  }

  let hd = new HDSegwitP2SHWallet();
  hd.setSecret(process.env.HD_MNEMONIC_BIP49_MANY_TX);
  assert.ok(hd.validateMnemonic());
  let start = +new Date();
  await hd.fetchBalance();
  let end = +new Date();
  const took = (end - start) / 1000;
  took > 15 && console.warn('took', took, "sec to fetch huge HD wallet's balance");
  assert.strictEqual(hd.getBalance(), 51432);

  await hd.fetchUtxo();
  assert.ok(hd.utxo.length > 0);
  assert.ok(hd.utxo[0].txid);
  assert.ok(hd.utxo[0].vout === 0);
  assert.ok(hd.utxo[0].amount);

  await hd.fetchTransactions();
  assert.strictEqual(hd.getTransactions().length, 107);
});
