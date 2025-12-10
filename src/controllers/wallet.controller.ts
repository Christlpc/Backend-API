import { Response } from 'express';
import prisma from '../prisma';
import { AuthRequest } from '../middleware/auth.middleware';
import { handleControllerError } from '../utils/errorHandler';

// Helper to ensure wallet exists
const ensureWallet = async (userId: string) => {
    let wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
        wallet = await prisma.wallet.create({ data: { userId } });
    }
    return wallet;
};

export const getBalance = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const wallet = await ensureWallet(userId);
        res.json({ balance: wallet.balance, currency: 'XAF' });
    } catch (error) {
        handleControllerError(res, error, 'Failed to fetch wallet balance');
    }
};

export const deposit = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        const { amount, paymentMethod } = req.body;

        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });

        const wallet = await prisma.wallet.upsert({
            where: { userId },
            update: { balance: { increment: amount } },
            create: { userId, balance: amount }
        });

        await prisma.transaction.create({
            data: {
                walletId: wallet.id,
                amount,
                type: 'DEPOSIT',
                status: 'COMPLETED',
                description: `Deposit via ${paymentMethod}`
            }
        });

        res.json({ message: 'Deposit successful', balance: wallet.balance });
    } catch (error) {
        handleControllerError(res, error, 'Deposit failed');
    }
};

export const withdraw = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        const { amount } = req.body;

        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });

        const wallet = await prisma.wallet.findUnique({ where: { userId } });
        if (!wallet || wallet.balance < amount) {
            return res.status(400).json({ error: 'Insufficient funds' });
        }

        const updatedWallet = await prisma.wallet.update({
            where: { userId },
            data: { balance: { decrement: amount } }
        });

        await prisma.transaction.create({
            data: {
                walletId: wallet.id,
                amount,
                type: 'WITHDRAWAL',
                status: 'PENDING'
            }
        });

        res.json({ message: 'Withdrawal request submitted', balance: updatedWallet.balance });
    } catch (error) {
        handleControllerError(res, error, 'Withdrawal failed');
    }
};

export const getTransactions = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const wallet = await prisma.wallet.findUnique({ where: { userId } });
        if (!wallet) return res.json({ transactions: [] });

        const transactions = await prisma.transaction.findMany({
            where: { walletId: wallet.id },
            orderBy: { createdAt: 'desc' }
        });

        res.json({ transactions });
    } catch (error) {
        handleControllerError(res, error, 'Failed to fetch transactions');
    }
};
