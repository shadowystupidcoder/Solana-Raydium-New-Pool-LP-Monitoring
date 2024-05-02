import { PublicKey, Keypair, Connection, ComputeBudgetProgram, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js';
import { u8, struct, NearUInt64 } from "@solana/buffer-layout"
import { u64, publicKey } from "@solana/buffer-layout-utils"
import * as spl from "@solana/spl-token"
import BN from 'bn.js'
import { getKeys } from "./getKeys.mjs";
import { EventEmitter } from 'events';

const connection = new Connection("https://convincing-crimson-mountain.solana-mainnet.quiknode.pro/6192efb0bbf8f7dfc1966cb92b88a7967fe5e4dc/")
const raydiumFees = new PublicKey("7YttLkHDoNj9wyDur5pM1ejNaAvT9X4eqaYcHQqtj2G5");
const initLog = struct([u8('logType'), u64('openTime'), u8('quoteDecimals'), u8('baseDecimals'), u64('quoteLotSize'), u64('baseLotSize'), u64('quoteAmount'), u64('baseAmount'), publicKey('market') ]);
// 1. listening to the logs from the raydium fee address
async function snipe() {
console.log("listening for new raydium pools...")
connection.onLogs(raydiumFees, async (logs) => {
for (const log of logs.logs) {
if (log.includes("ray_log")) {
const rayLog = log.split(" ").pop().replace("'", "");
console.log(Buffer.from(rayLog, "base64").length)
const { market, baseDecimals, quoteDecimals, openTime } = initLog.decode(Buffer.from(rayLog, "base64"));
console.log(market)
const keys = await getKeys(market, baseDecimals, quoteDecimals);
const balEmit = new EventEmitter()
monitor(market, keys.baseVault, keys.quoteVault, balEmit)
}
}
})}
snipe()

async function monitor(marketId, baseVault, quoteVault, balEmit) {
    let baseVaultData = { balance: 0, slot: 0 }
    let quoteVaultData = { balance: 0, slot: 0 }
    let initialBalance = null;
    let lastBalance = null;
    const getUpdatedBalance = async (ata, vaultType) => {
        connection.onAccountChange(ata, (info, context) => {
            const balance = new NearUInt64().decode(new Uint8Array(info.data.subarray(64, 72)))
            const slot = context.slot
            balEmit.emit('balanceUpdated', { balance, slot, vaultType })
        }, { dataSlice: { offset: 64, length: 8 } })
    }
    getUpdatedBalance(quoteVault, 'quote')
    getUpdatedBalance(baseVault, 'base')
let lastPrice = null;
let balanceBeforeDrop = null;
balEmit.on('balanceUpdated', function balanceUpdateHandler({ balance, slot, vaultType }) {
    if (vaultType === 'quote') {
        quoteVaultData = { balance, slot };
        if (initialBalance === null) {
            initialBalance = balance;
        }
        if (lastPrice !== null && balance / baseVaultData.balance < lastPrice * 0.5) {
            balanceBeforeDrop = lastBalance;
        }
        lastBalance = balance;
    } else if (vaultType === 'base') {
        baseVaultData = { balance, slot };
    }
    if (quoteVaultData.slot === baseVaultData.slot) {
        const price = quoteVaultData.balance / baseVaultData.balance;
console.log(`market: ${marketId} -> base lp: ${baseVaultData.balance / Math.pow(10, 9)} -> quote lp: ${quoteVaultData.balance / Math.pow(10, 9)} -> price: ${price}`);
        if (balanceBeforeDrop !== null) {
            balEmit.removeListener('balanceUpdated', balanceUpdateHandler);
            console.log(`${marketId} rugged, stopped monitoring.`);
        }
let priceHistory = [];
        lastPrice = price;
    }
})}