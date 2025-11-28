import { Response } from 'express';
import prisma from '../prisma';
import { AuthRequest } from '../middleware/auth.middleware';

// Helper to ensure wallet exists
const ensureWallet = async (userId: number) => {
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
        res.json({ balance: wallet.balance });
    } catch (error) {
        console.error('Get balance error:', error);
        res.status(500).json({ error: 'Failed to fetch balance' });
    }
};

export const deposit = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        const role = req.user?.role;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        // Only CLIENT can deposit (as per requirement: "client he can put money in his wallet only")
        // Assuming 'CLIENT' is the default role or explicit role check needed
        // However, the requirement says "client he can put money", implying drivers cannot?
        // Let's enforce it if role is available.
        if (role === 'DRIVER') {
            return res.status(403).json({ error: 'Drivers cannot deposit funds manually' });
        }

        const { amount } = req.body;
        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Invalid amount' });
        }

        const wallet = await ensureWallet(userId);

        // Simulate Payment Gateway Success
        const updatedWallet = await prisma.$transaction(async (tx) => {
            // Create Transaction
            await tx.transaction.create({
                data: {
                    walletId: wallet.id,
                    amount,
                    type: 'DEPOSIT',
                    status: 'COMPLETED'
                }
            });

            // Update Balance
            return await tx.wallet.update({
                where: { id: wallet.id },
                data: { balance: { increment: amount } }
            });
        });

        res.json({ message: 'Deposit successful', balance: updatedWallet.balance });
    } catch (error) {
        console.error('Deposit error:', error);
        res.status(500).json({ error: 'Deposit failed' });
    }
};

export const withdraw = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        const role = req.user?.role;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        // Only DRIVER can withdraw
        if (role !== 'DRIVER') {
            return res.status(403).json({ error: 'Only drivers can withdraw funds' });
        }

        const { amount } = req.body;
        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Invalid amount' });
        }

        const wallet = await ensureWallet(userId);

        if (wallet.balance < amount) {
            return res.status(400).json({ error: 'Insufficient funds' });
        }

        // Simulate Withdrawal Success
        const updatedWallet = await prisma.$transaction(async (tx) => {
            // Create Transaction
            await tx.transaction.create({
                data: {
                    walletId: wallet.id,
                    amount,
                    type: 'WITHDRAWAL',
                    status: 'COMPLETED'
                }
            });

            // Update Balance
            return await tx.wallet.update({
                where: { id: wallet.id },
                data: { balance: { decrement: amount } }
            });
        });

        res.json({ message: 'Withdrawal successful', balance: updatedWallet.balance });
    } catch (error) {
        console.error('Withdrawal error:', error);
        res.status(500).json({ error: 'Withdrawal failed' });
    }
};

export const getTransactions = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const wallet = await ensureWallet(userId);

        const transactions = await prisma.transaction.findMany({
            where: { walletId: wallet.id },
            orderBy: { createdAt: 'desc' }
        });

        res.json({ transactions });
    } catch (error) {
        console.error('Get transactions error:', error);
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
};
