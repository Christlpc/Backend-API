import { Response } from 'express';
import prisma from '../prisma';
import { AuthRequest } from '../middleware/auth.middleware';
import { handleControllerError } from '../utils/errorHandler';

// ============================================
// RATING ENDPOINTS
// ============================================

/**
 * Client rates driver after ride completion
 */
export const rateDriver = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        const { id: rideId } = req.params;
        const { rating, comment } = req.body;

        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'Rating must be between 1 and 5' });
        }

        // Get ride and verify client
        const ride = await prisma.ride.findUnique({
            where: { id: rideId },
            include: { driver: true }
        });

        if (!ride) return res.status(404).json({ error: 'Ride not found' });
        if (ride.clientId !== userId) {
            return res.status(403).json({ error: 'You can only rate rides you took' });
        }
        if (ride.status !== 'COMPLETED') {
            return res.status(400).json({ error: 'Can only rate completed rides' });
        }
        if (!ride.driverId || !ride.driver) {
            return res.status(400).json({ error: 'Ride has no driver' });
        }

        // Create or update rating
        const rideRating = await prisma.rideRating.upsert({
            where: {
                rideId_raterType: {
                    rideId,
                    raterType: 'CLIENT'
                }
            },
            update: { rating, comment },
            create: {
                rideId,
                raterId: userId,
                raterType: 'CLIENT',
                rateeId: ride.driver.id,
                rateeType: 'DRIVER',
                rating,
                comment
            }
        });

        // Update driver reputation
        await updateDriverReputation(ride.driver.id);

        res.status(201).json({
            message: 'Rating submitted successfully',
            rating: rideRating
        });
    } catch (error) {
        handleControllerError(res, error, 'Failed to submit rating');
    }
};

/**
 * Driver rates client after ride completion
 */
export const rateClient = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        const { id: rideId } = req.params;
        const { rating, comment } = req.body;

        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'Rating must be between 1 and 5' });
        }

        // Get driver profile
        const driver = await prisma.driverProfile.findUnique({
            where: { userId }
        });

        if (!driver) return res.status(404).json({ error: 'Driver profile not found' });

        // Get ride and verify driver
        const ride = await prisma.ride.findUnique({
            where: { id: rideId }
        });

        if (!ride) return res.status(404).json({ error: 'Ride not found' });
        if (ride.driverId !== driver.id) {
            return res.status(403).json({ error: 'You can only rate rides you drove' });
        }
        if (ride.status !== 'COMPLETED') {
            return res.status(400).json({ error: 'Can only rate completed rides' });
        }

        // Create or update rating
        const rideRating = await prisma.rideRating.upsert({
            where: {
                rideId_raterType: {
                    rideId,
                    raterType: 'DRIVER'
                }
            },
            update: { rating, comment },
            create: {
                rideId,
                raterId: driver.id,
                raterType: 'DRIVER',
                rateeId: ride.clientId,
                rateeType: 'CLIENT',
                rating,
                comment
            }
        });

        // Update client reputation
        await updateClientReputation(ride.clientId);

        res.status(201).json({
            message: 'Rating submitted successfully',
            rating: rideRating
        });
    } catch (error) {
        handleControllerError(res, error, 'Failed to submit rating');
    }
};

/**
 * Get current user's received ratings
 */
export const getMyRatings = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        const userRole = req.user?.role;

        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        let ratings;
        let stats;

        if (userRole === 'DRIVER') {
            const driver = await prisma.driverProfile.findUnique({
                where: { userId }
            });

            if (!driver) return res.status(404).json({ error: 'Driver profile not found' });

            ratings = await prisma.rideRating.findMany({
                where: {
                    rateeId: driver.id,
                    rateeType: 'DRIVER'
                },
                orderBy: { createdAt: 'desc' },
                take: 20,
                include: {
                    ride: {
                        select: {
                            originAddress: true,
                            destAddress: true,
                            completedAt: true
                        }
                    }
                }
            });

            stats = {
                averageRating: driver.averageRating,
                totalRatings: driver.totalRatings,
                reputationStatus: driver.reputationStatus,
                consecutiveBadRatings: driver.consecutiveBadRatings
            };
        } else {
            const user = await prisma.user.findUnique({
                where: { id: userId }
            });

            if (!user) return res.status(404).json({ error: 'User not found' });

            ratings = await prisma.rideRating.findMany({
                where: {
                    rateeId: userId,
                    rateeType: 'CLIENT'
                },
                orderBy: { createdAt: 'desc' },
                take: 20,
                include: {
                    ride: {
                        select: {
                            originAddress: true,
                            destAddress: true,
                            completedAt: true
                        }
                    }
                }
            });

            stats = {
                averageRating: user.averageRating,
                totalRatings: user.totalRatings,
                reputationStatus: user.reputationStatus,
                consecutiveBadRatings: user.consecutiveBadRatings
            };
        }

        res.json({ ratings, stats });
    } catch (error) {
        handleControllerError(res, error, 'Failed to fetch ratings');
    }
};

/**
 * Get ratings for a specific ride
 */
export const getRideRatings = async (req: AuthRequest, res: Response) => {
    try {
        const { id: rideId } = req.params;

        const ratings = await prisma.rideRating.findMany({
            where: { rideId }
        });

        res.json({ ratings });
    } catch (error) {
        handleControllerError(res, error, 'Failed to fetch ride ratings');
    }
};

// ============================================
// REPUTATION ALGORITHM
// ============================================

async function getConfig() {
    let config = await prisma.ratingConfig.findFirst();
    if (!config) {
        // Create default config if none exists
        config = await prisma.ratingConfig.create({
            data: {}
        });
    }
    return config;
}

async function updateDriverReputation(driverId: string) {
    const config = await getConfig();

    // Get recent ratings for this driver
    const recentRatings = await prisma.rideRating.findMany({
        where: {
            rateeId: driverId,
            rateeType: 'DRIVER'
        },
        orderBy: { createdAt: 'desc' },
        take: config.evaluationPeriod
    });

    if (recentRatings.length === 0) return;

    // Calculate average
    const sum = recentRatings.reduce((acc, r) => acc + r.rating, 0);
    const average = sum / recentRatings.length;

    // Count consecutive bad ratings (from most recent)
    let consecutiveBad = 0;
    for (const r of recentRatings) {
        if (r.rating <= config.badRatingThreshold) {
            consecutiveBad++;
        } else {
            break; // Stop counting when we hit a good rating
        }
    }

    // Determine reputation status
    let reputationStatus = 'GOOD';
    let shouldSuspend = false;

    if (consecutiveBad >= config.autoSuspendThreshold) {
        reputationStatus = 'SUSPENDED';
        shouldSuspend = true;
    } else if (consecutiveBad >= config.redZoneThreshold) {
        reputationStatus = 'RED_ZONE';
    } else if (consecutiveBad >= config.warningThreshold) {
        reputationStatus = 'WARNING';
    }

    // Update driver profile
    await prisma.driverProfile.update({
        where: { id: driverId },
        data: {
            averageRating: Math.round(average * 10) / 10,
            totalRatings: await prisma.rideRating.count({
                where: { rateeId: driverId, rateeType: 'DRIVER' }
            }),
            consecutiveBadRatings: consecutiveBad,
            reputationStatus,
            isApproved: shouldSuspend ? false : undefined,
            isAvailable: shouldSuspend ? false : undefined
        }
    });

    // If suspended, also update user account
    if (shouldSuspend) {
        const driver = await prisma.driverProfile.findUnique({
            where: { id: driverId }
        });
        if (driver) {
            await prisma.user.update({
                where: { id: driver.userId },
                data: {
                    isActive: false,
                    suspendedAt: new Date(),
                    suspendReason: `Automatic suspension: ${consecutiveBad} consecutive bad ratings`
                }
            });
        }
    }
}

async function updateClientReputation(clientId: string) {
    const config = await getConfig();

    // Get recent ratings for this client
    const recentRatings = await prisma.rideRating.findMany({
        where: {
            rateeId: clientId,
            rateeType: 'CLIENT'
        },
        orderBy: { createdAt: 'desc' },
        take: config.evaluationPeriod
    });

    if (recentRatings.length === 0) return;

    // Calculate average
    const sum = recentRatings.reduce((acc, r) => acc + r.rating, 0);
    const average = sum / recentRatings.length;

    // Count consecutive bad ratings
    let consecutiveBad = 0;
    for (const r of recentRatings) {
        if (r.rating <= config.badRatingThreshold) {
            consecutiveBad++;
        } else {
            break;
        }
    }

    // Determine reputation status
    let reputationStatus = 'GOOD';
    let shouldSuspend = false;

    if (consecutiveBad >= config.autoSuspendThreshold) {
        reputationStatus = 'SUSPENDED';
        shouldSuspend = true;
    } else if (consecutiveBad >= config.redZoneThreshold) {
        reputationStatus = 'RED_ZONE';
    } else if (consecutiveBad >= config.warningThreshold) {
        reputationStatus = 'WARNING';
    }

    // Update user
    await prisma.user.update({
        where: { id: clientId },
        data: {
            averageRating: Math.round(average * 10) / 10,
            totalRatings: await prisma.rideRating.count({
                where: { rateeId: clientId, rateeType: 'CLIENT' }
            }),
            consecutiveBadRatings: consecutiveBad,
            reputationStatus,
            lastRatingCheck: new Date(),
            isActive: shouldSuspend ? false : undefined,
            suspendedAt: shouldSuspend ? new Date() : undefined,
            suspendReason: shouldSuspend
                ? `Automatic suspension: ${consecutiveBad} consecutive bad ratings`
                : undefined
        }
    });
}

// ============================================
// ADMIN ENDPOINTS
// ============================================

/**
 * Get all users in red zone or suspended
 */
export const getRedZoneUsers = async (req: AuthRequest, res: Response) => {
    try {
        const [clients, drivers] = await Promise.all([
            prisma.user.findMany({
                where: {
                    reputationStatus: { in: ['RED_ZONE', 'SUSPENDED', 'WARNING'] }
                },
                select: {
                    id: true,
                    phone: true,
                    firstName: true,
                    lastName: true,
                    role: true,
                    averageRating: true,
                    consecutiveBadRatings: true,
                    reputationStatus: true,
                    isActive: true,
                    suspendedAt: true
                },
                orderBy: { consecutiveBadRatings: 'desc' }
            }),
            prisma.driverProfile.findMany({
                where: {
                    reputationStatus: { in: ['RED_ZONE', 'SUSPENDED', 'WARNING'] }
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            phone: true,
                            firstName: true,
                            lastName: true
                        }
                    }
                },
                orderBy: { consecutiveBadRatings: 'desc' }
            })
        ]);

        res.json({
            clients: clients.filter(c => c.role === 'CLIENT'),
            drivers: drivers.map(d => ({
                ...d,
                userName: `${d.user.firstName || ''} ${d.user.lastName || ''}`.trim(),
                userPhone: d.user.phone
            }))
        });
    } catch (error) {
        handleControllerError(res, error, 'Failed to fetch red zone users');
    }
};

/**
 * Get reputation status for a specific user
 */
export const getUserReputationStatus = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        const user = await prisma.user.findUnique({
            where: { id },
            include: {
                driverProfile: true
            }
        });

        if (!user) return res.status(404).json({ error: 'User not found' });

        // Get recent ratings
        let recentRatings;
        if (user.role === 'DRIVER' && user.driverProfile) {
            recentRatings = await prisma.rideRating.findMany({
                where: {
                    rateeId: user.driverProfile.id,
                    rateeType: 'DRIVER'
                },
                orderBy: { createdAt: 'desc' },
                take: 10
            });
        } else {
            recentRatings = await prisma.rideRating.findMany({
                where: {
                    rateeId: id,
                    rateeType: 'CLIENT'
                },
                orderBy: { createdAt: 'desc' },
                take: 10
            });
        }

        const clientStats = {
            averageRating: user.averageRating,
            totalRatings: user.totalRatings,
            consecutiveBadRatings: user.consecutiveBadRatings,
            reputationStatus: user.reputationStatus
        };

        const driverStats = user.driverProfile ? {
            averageRating: user.driverProfile.averageRating,
            totalRatings: user.driverProfile.totalRatings,
            consecutiveBadRatings: user.driverProfile.consecutiveBadRatings,
            reputationStatus: user.driverProfile.reputationStatus
        } : null;

        res.json({
            user: {
                id: user.id,
                name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
                phone: user.phone,
                role: user.role,
                isActive: user.isActive
            },
            clientStats,
            driverStats,
            recentRatings
        });
    } catch (error) {
        handleControllerError(res, error, 'Failed to fetch reputation status');
    }
};

/**
 * Reset user reputation (admin action)
 */
export const resetUserReputation = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { resetClient, resetDriver, reactivate } = req.body;

        const user = await prisma.user.findUnique({
            where: { id },
            include: { driverProfile: true }
        });

        if (!user) return res.status(404).json({ error: 'User not found' });

        // Reset client reputation
        if (resetClient !== false) {
            await prisma.user.update({
                where: { id },
                data: {
                    consecutiveBadRatings: 0,
                    reputationStatus: 'GOOD',
                    isActive: reactivate ? true : undefined,
                    suspendedAt: reactivate ? null : undefined,
                    suspendReason: reactivate ? null : undefined
                }
            });
        }

        // Reset driver reputation
        if (resetDriver !== false && user.driverProfile) {
            await prisma.driverProfile.update({
                where: { id: user.driverProfile.id },
                data: {
                    consecutiveBadRatings: 0,
                    reputationStatus: 'GOOD',
                    isApproved: reactivate ? true : undefined
                }
            });
        }

        res.json({ message: 'Reputation reset successfully' });
    } catch (error) {
        handleControllerError(res, error, 'Failed to reset reputation');
    }
};

/**
 * Get rating configuration
 */
export const getRatingConfig = async (req: AuthRequest, res: Response) => {
    try {
        const config = await getConfig();
        res.json({ config });
    } catch (error) {
        handleControllerError(res, error, 'Failed to fetch rating config');
    }
};

/**
 * Update rating configuration
 */
export const updateRatingConfig = async (req: AuthRequest, res: Response) => {
    try {
        const {
            badRatingThreshold,
            warningThreshold,
            redZoneThreshold,
            autoSuspendThreshold,
            evaluationPeriod
        } = req.body;

        let config = await prisma.ratingConfig.findFirst();

        if (!config) {
            config = await prisma.ratingConfig.create({
                data: {
                    ...(badRatingThreshold && { badRatingThreshold }),
                    ...(warningThreshold && { warningThreshold }),
                    ...(redZoneThreshold && { redZoneThreshold }),
                    ...(autoSuspendThreshold && { autoSuspendThreshold }),
                    ...(evaluationPeriod && { evaluationPeriod })
                }
            });
        } else {
            config = await prisma.ratingConfig.update({
                where: { id: config.id },
                data: {
                    ...(badRatingThreshold && { badRatingThreshold }),
                    ...(warningThreshold && { warningThreshold }),
                    ...(redZoneThreshold && { redZoneThreshold }),
                    ...(autoSuspendThreshold && { autoSuspendThreshold }),
                    ...(evaluationPeriod && { evaluationPeriod })
                }
            });
        }

        res.json({ message: 'Configuration updated', config });
    } catch (error) {
        handleControllerError(res, error, 'Failed to update rating config');
    }
};
