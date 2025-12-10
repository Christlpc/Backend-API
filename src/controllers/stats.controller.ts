import { Response } from 'express';
import prisma from '../prisma';
import { AuthRequest } from '../middleware/auth.middleware';
import { handleControllerError } from '../utils/errorHandler';

type TimeFrame = 'day' | 'week' | 'month';

const getDateRange = (timeframe: TimeFrame) => {
    const now = new Date();
    let startDate = new Date();

    if (timeframe === 'day') {
        startDate.setHours(0, 0, 0, 0);
    } else if (timeframe === 'week') {
        const day = startDate.getDay();
        const diff = startDate.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
        startDate.setDate(diff);
        startDate.setHours(0, 0, 0, 0);
    } else if (timeframe === 'month') {
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
    }

    return { startDate, endDate: now };
};

export const getDriverStats = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        const timeframe = (req.query.timeframe as TimeFrame) || 'day';

        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const driver = await prisma.driverProfile.findUnique({ where: { userId } });
        if (!driver) return res.status(404).json({ error: 'Driver profile not found' });

        const { startDate, endDate } = getDateRange(timeframe);

        const rides = await prisma.ride.findMany({
            where: {
                driverId: driver.id,
                status: 'COMPLETED',
                completedAt: {
                    gte: startDate,
                    lte: endDate
                }
            }
        });

        const totalRides = rides.length;
        const totalRevenue = rides.reduce((sum, ride) => sum + (ride.finalPrice || 0), 0);
        const totalEarnings = totalRevenue * 0.8; // 20% commission

        let totalDurationMs = 0;
        let ridesWithDuration = 0;

        rides.forEach(ride => {
            if (ride.startedAt && ride.completedAt) {
                totalDurationMs += (ride.completedAt.getTime() - ride.startedAt.getTime());
                ridesWithDuration++;
            }
        });

        const avgDurationMinutes = ridesWithDuration > 0
            ? (totalDurationMs / ridesWithDuration) / (1000 * 60)
            : 0;

        res.json({
            timeframe,
            totalRides,
            totalRevenue,
            totalEarnings,
            avgDurationMinutes: Math.round(avgDurationMinutes),
            currency: 'XAF'
        });
    } catch (error) {
        handleControllerError(res, error, 'Failed to fetch driver stats');
    }
};

export const getClientStats = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        const timeframe = (req.query.timeframe as TimeFrame) || 'day';

        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { startDate, endDate } = getDateRange(timeframe);

        const rides = await prisma.ride.findMany({
            where: {
                clientId: userId,
                status: 'COMPLETED',
                completedAt: {
                    gte: startDate,
                    lte: endDate
                }
            }
        });

        const totalRides = rides.length;
        const totalSpent = rides.reduce((sum, ride) => sum + (ride.finalPrice || 0), 0);

        let totalDurationMs = 0;
        let ridesWithDuration = 0;

        rides.forEach(ride => {
            if (ride.startedAt && ride.completedAt) {
                totalDurationMs += (ride.completedAt.getTime() - ride.startedAt.getTime());
                ridesWithDuration++;
            }
        });

        const avgDurationMinutes = ridesWithDuration > 0
            ? (totalDurationMs / ridesWithDuration) / (1000 * 60)
            : 0;

        res.json({
            timeframe,
            totalRides,
            totalSpent,
            avgDurationMinutes: Math.round(avgDurationMinutes),
            currency: 'XAF'
        });
    } catch (error) {
        handleControllerError(res, error, 'Failed to fetch client stats');
    }
};
