import { Response } from 'express';
import prisma from '../prisma';
import { AuthRequest } from '../middleware/auth.middleware';
import { getIO } from '../socket';
import { processPayment } from './payment.controller';

// Helper to ensure user is a driver
const ensureDriver = async (userId: number) => {
    const driver = await prisma.driverProfile.findUnique({
        where: { userId },
    });
    if (!driver) {
        // Auto-create driver profile if it doesn't exist for now (simplification)
        return await prisma.driverProfile.create({
            data: { userId, isAvailable: true }
        });
    }
    return driver;
};

export const toggleAvailability = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { isAvailable } = req.body;
        let driver = await ensureDriver(userId);

        driver = await prisma.driverProfile.update({
            where: { id: driver.id },
            data: { isAvailable },
        });

        res.json({ message: 'Availability updated', isAvailable: driver.isAvailable });
    } catch (error) {
        console.error('Availability error:', error);
        res.status(500).json({ error: 'Failed to update availability' });
    }
};

export const updateLocation = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { lat, lng } = req.body;
        if (!lat || !lng) return res.status(400).json({ error: 'Coordinates required' });

        let driver = await ensureDriver(userId);

        driver = await prisma.driverProfile.update({
            where: { id: driver.id },
            data: { currentLat: lat, currentLng: lng },
        });

        res.json({ message: 'Location updated' });
    } catch (error) {
        console.error('Location error:', error);
        res.status(500).json({ error: 'Failed to update location' });
    }
};

export const getAvailableRides = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        // In a real app, filter by location radius
        const rides = await prisma.ride.findMany({
            where: { status: 'REQUESTED' },
            orderBy: { createdAt: 'desc' }
        });

        res.json({ rides });
    } catch (error) {
        console.error('Get rides error:', error);
        res.status(500).json({ error: 'Failed to fetch rides' });
    }
};

export const acceptRide = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { id } = req.params;
        const driver = await ensureDriver(userId);

        // Transaction to ensure ride is still available
        const ride = await prisma.$transaction(async (tx) => {
            const targetRide = await tx.ride.findUnique({ where: { id: Number(id) } });

            if (!targetRide || targetRide.status !== 'REQUESTED') {
                throw new Error('Ride not available');
            }

            return await tx.ride.update({
                where: { id: Number(id) },
                data: {
                    driverId: driver.id,
                    status: 'ACCEPTED'
                }
            });
        });

        // Notify client
        getIO().to(`user_${ride.clientId}`).emit('ride_status_update', { status: 'ACCEPTED', ride });

        res.json({ message: 'Ride accepted', ride });
    } catch (error: any) {
        console.error('Accept ride error:', error);
        res.status(400).json({ error: error.message || 'Failed to accept ride' });
    }
};

export const updateRideStatus = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { id } = req.params;
        const { status } = req.body; // IN_PROGRESS, COMPLETED

        if (!['IN_PROGRESS', 'COMPLETED'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const driver = await ensureDriver(userId);

        const ride = await prisma.ride.findFirst({
            where: { id: Number(id), driverId: driver.id }
        });

        if (!ride) {
            return res.status(404).json({ error: 'Ride not found or not assigned to you' });
        }

        const updatedRide = await prisma.ride.update({
            where: { id: Number(id) },
            data: { status }
        });

        // If completed, process payment
        if (status === 'COMPLETED') {
            // Ensure finalPrice is set (for now assume estimatedPrice if not set, or it should be passed in body)
            // In a real app, driver sends final meter price.
            // Let's assume for this MVP, finalPrice = estimatedPrice if not updated.
            if (!updatedRide.finalPrice) {
                await prisma.ride.update({
                    where: { id: Number(id) },
                    data: { finalPrice: updatedRide.estimatedPrice }
                });
            }
            await processPayment(Number(id));
        }

        // Notify client
        getIO().to(`user_${updatedRide.clientId}`).emit('ride_status_update', { status, ride: updatedRide });

        res.json({ message: 'Ride status updated', ride: updatedRide });
    } catch (error) {
        console.error('Update status error:', error);
        res.status(500).json({ error: 'Failed to update ride status' });
    }
};
