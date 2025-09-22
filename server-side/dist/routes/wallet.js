"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const viem_1 = require("viem");
const chains_1 = require("viem/chains");
const accounts_1 = require("viem/accounts");
const ecdsa_validator_1 = require("@zerodev/ecdsa-validator");
const sdk_1 = require("@zerodev/sdk");
const constants_1 = require("@zerodev/sdk/constants");
const router = (0, express_1.Router)();
router.get("/test", async (req, res) => {
    res.json({ message: "Test wallet!" });
});
router.post("/send", async (req, res) => {
    try {
        const { to, amount } = req.body; // amount in wei
        const rpcUrl = process.env.ZERODEV_RPC;
        const privateKey = process.env.PRIVATE_KEY;
        const chain = chains_1.sepolia;
        const publicClient = (0, viem_1.createPublicClient)({ chain, transport: (0, viem_1.http)(rpcUrl) });
        const entryPoint = (0, constants_1.getEntryPoint)("0.7");
        const signer = (0, accounts_1.privateKeyToAccount)(privateKey);
        // Validator
        const ecdsaValidator = await (0, ecdsa_validator_1.signerToEcdsaValidator)(publicClient, {
            signer,
            entryPoint,
            kernelVersion: constants_1.KERNEL_V3_3,
        });
        // Kernel account
        const account = await (0, sdk_1.createKernelAccount)(publicClient, {
            entryPoint,
            plugins: { sudo: ecdsaValidator },
            kernelVersion: constants_1.KERNEL_V3_3,
        });
        // Paymaster
        const zerodevPaymaster = (0, sdk_1.createZeroDevPaymasterClient)({
            chain,
            transport: (0, viem_1.http)(rpcUrl),
        });
        // Kernel client
        const kernelClient = (0, sdk_1.createKernelAccountClient)({
            account,
            chain,
            bundlerTransport: (0, viem_1.http)(rpcUrl),
            paymaster: {
                getPaymasterData(userOperation) {
                    return zerodevPaymaster.sponsorUserOperation({ userOperation });
                },
            },
        });
        // Send native ETH transfer
        const userOpHash = await kernelClient.sendUserOperation({
            callData: await kernelClient.account.encodeCalls([
                {
                    to,
                    value: BigInt(amount), // must be wei
                    data: "0x",
                },
            ]),
        });
        const receipt = await kernelClient.waitForUserOperationReceipt({
            hash: userOpHash,
        });
        res.json({
            txHash: receipt.receipt.transactionHash,
            smartWallet: account.address,
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});
exports.default = router;
