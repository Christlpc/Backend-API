import { Response } from 'express';
import prisma from '../prisma';
import { AuthRequest } from '../middleware/auth.middleware';

export const addAddress = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { label, addressText, latitude, longitude, landmark, details } = req.body;

        if (!label || !addressText || !latitude || !longitude) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const address = await prisma.savedAddress.create({
            data: {
                userId,
                label,
                addressText,
                latitude,
                longitude,
                landmark,
                details
            }
        });

        res.status(201).json({ message: 'Address saved', address });
    } catch (error) {
        console.error('Add address error:', error);
        res.status(500).json({ error: 'Failed to save address' });
    }
};

export const getAddresses = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const addresses = await prisma.savedAddress.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' }
        });

        res.json({ addresses });
    } catch (error) {
        console.error('Get addresses error:', error);
        res.status(500).json({ error: 'Failed to fetch addresses' });
    }
};

export const updateAddress = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        const { id } = req.params;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { label, addressText, latitude, longitude, landmark, details } = req.body;

        const address = await prisma.savedAddress.findUnique({ where: { id: Number(id) } });
        if (!address || address.userId !== userId) {
            return res.status(404).json({ error: 'Address not found' });
        }

        const updatedAddress = await prisma.savedAddress.update({
            where: { id: Number(id) },
            data: {
                label,
                addressText,
                latitude,
                longitude,
                landmark,
                details
            }
        });

        res.json({ message: 'Address updated', address: updatedAddress });
    } catch (error) {
        console.error('Update address error:', error);
        res.status(500).json({ error: 'Failed to update address' });
    }
};

export const deleteAddress = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        const { id } = req.params;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const address = await prisma.savedAddress.findUnique({ where: { id: Number(id) } });
        if (!address || address.userId !== userId) {
            return res.status(404).json({ error: 'Address not found' });
        }

        await prisma.savedAddress.delete({ where: { id: Number(id) } });

        res.json({ message: 'Address deleted' });
    } catch (error) {
        console.error('Delete address error:', error);
        res.status(500).json({ error: 'Failed to delete address' });
    }
};
