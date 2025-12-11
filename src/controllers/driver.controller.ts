import { Response } from 'express';
import prisma from '../prisma';
import { AuthRequest } from '../middleware/auth.middleware';
import { getIO } from '../socket';
import { processPayment } from './payment.controller';
import { handleControllerError } from '../utils/errorHandler';
import * as notificationService from '../services/notification.service';

// Helper to ensure user is a driver
const ensureDriver = async (userId: string) => {
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

        const driver = await prisma.driverProfile.findUnique({ where: { userId } });
        if (!driver) return res.status(404).json({ error: 'Driver profile not found' });

        const updatedDriver = await prisma.driverProfile.update({
            where: { userId },
            data: { isAvailable: !driver.isAvailable }
        });

        res.json({ message: 'Availability updated', isAvailable: updatedDriver.isAvailable });
    } catch (error) {
        handleControllerError(res, error, 'Failed to toggle availability');
    }
};

export const updateLocation = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        const { latitude, longitude } = req.body;

        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (!latitude || !longitude) return res.status(400).json({ error: 'Missing coordinates' });

        await prisma.driverProfile.update({
            where: { userId },
            data: {
                currentLat: latitude,
                currentLng: longitude
            }
        });

        res.json({ message: 'Location updated' });
    } catch (error) {
        handleControllerError(res, error, 'Failed to update location');
    }
};

export const getAvailableRides = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        // Simple logic: return all REQUESTED rides
        // In real app: Filter by radius
        const rides = await prisma.ride.findMany({
            where: { status: 'REQUESTED' },
            orderBy: { createdAt: 'desc' }
        });

        res.json({ rides });
    } catch (error) {
        handleControllerError(res, error, 'Failed to fetch rides');
    }
};

export const acceptRide = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        const rideId = req.params.id;

        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (!rideId) return res.status(400).json({ error: 'Invalid ride ID' });

        const driver = await prisma.driverProfile.findUnique({
            where: { userId },
            include: { user: { select: { firstName: true } } }
        });
        if (!driver) return res.status(404).json({ error: 'Driver profile not found' });

        // Transaction to ensure atomicity
        const ride = await prisma.$transaction(async (tx) => {
            const r = await tx.ride.findUnique({ where: { id: rideId } });
            if (!r) throw new Error('Ride not found');
            if (r.status !== 'REQUESTED') throw new Error('Ride already taken or cancelled');

            return await tx.ride.update({
                where: { id: rideId },
                data: {
                    driverId: driver.id,
                    status: 'ACCEPTED'
                }
            });
        });

        // Notify client via Socket.IO
        getIO().to(`user_${ride.clientId}`).emit('ride_accepted', ride);

        // Send push notification to client
        const driverName = driver.user.firstName || 'Votre chauffeur';
        await notificationService.notifyRideAccepted(ride.clientId, driverName);

        res.json({ message: 'Ride accepted', ride });
    } catch (error: any) {
        if (error.message === 'Ride not found' || error.message === 'Ride already taken or cancelled') {
            return res.status(400).json({ error: error.message });
        }
        handleControllerError(res, error, 'Failed to accept ride');
    }
};

export const updateRideStatus = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        const rideId = req.params.id;
        const { status } = req.body; // ARRIVED, IN_PROGRESS, COMPLETED, CANCELLED

        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (!rideId) return res.status(400).json({ error: 'Invalid ride ID' });

        const validStatuses = ['ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        // Get current ride for driver info
        const currentRide = await prisma.ride.findUnique({
            where: { id: rideId },
            include: { driver: true }
        });
        if (!currentRide) return res.status(404).json({ error: 'Ride not found' });

        const updateData: any = { status };
        if (status === 'IN_PROGRESS') {
            updateData.startedAt = new Date();
        } else if (status === 'COMPLETED') {
            updateData.completedAt = new Date();
        }

        const ride = await prisma.ride.update({
            where: { id: rideId },
            data: updateData
        });

        // Notify via Socket.IO
        getIO().to(`user_${ride.clientId}`).emit('ride_status_update', ride);

        // Send push notifications based on status
        switch (status) {
            case 'ARRIVED':
                await notificationService.notifyDriverArrived(ride.clientId);
                break;
            case 'IN_PROGRESS':
                await notificationService.notifyRideStarted(ride.clientId);
                break;
            case 'COMPLETED':
                const finalAmount = ride.finalPrice || ride.estimatedPrice;
                // Notify client
                await notificationService.notifyRideCompleted(ride.clientId, finalAmount, false);
                // Notify driver
                if (currentRide.driver?.userId) {
                    await notificationService.notifyRideCompleted(currentRide.driver.userId, finalAmount, true);
                }
                // Process payment
                await processPayment(rideId);
                break;
            case 'CANCELLED':
                // Notify driver that client cancelled
                if (currentRide.driver?.userId) {
                    await notificationService.notifyRideCancelled(currentRide.driver.userId);
                }
                break;
        }

        res.json({ message: 'Ride status updated', ride });
    } catch (error) {
        handleControllerError(res, error, 'Failed to update ride status');
    }
};
