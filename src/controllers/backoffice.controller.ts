import { Response } from 'express';
import prisma from '../prisma';
import { AuthRequest } from '../middleware/auth.middleware';
import { handleControllerError } from '../utils/errorHandler';

// ============================================
// USER MANAGEMENT
// ============================================

/**
 * Get all users with pagination and filters
 * Query params: page, limit, role, status, search
 */
export const getAllUsers = async (req: AuthRequest, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const role = req.query.role as string;
        const status = req.query.status as string; // active, inactive
        const search = req.query.search as string;

        const skip = (page - 1) * limit;

        const where: any = {};

        if (role) {
            where.role = role;
        }

        if (status === 'active') {
            where.isActive = true;
        } else if (status === 'inactive') {
            where.isActive = false;
        }

        if (search) {
            where.OR = [
                { phone: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } }
            ];
        }

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    phone: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    role: true,
                    isActive: true,
                    suspendedAt: true,
                    createdAt: true,
                    updatedAt: true,
                    _count: {
                        select: {
                            ridesAsClient: true
                        }
                    }
                }
            }),
            prisma.user.count({ where })
        ]);

        res.json({
            users,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        handleControllerError(res, error, 'Failed to fetch users');
    }
};

/**
 * Get user by ID with all relations
 */
export const getUserById = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        const user = await prisma.user.findUnique({
            where: { id },
            include: {
                driverProfile: {
                    include: {
                        vehicle: true
                    }
                },
                wallet: true,
                _count: {
                    select: {
                        ridesAsClient: true,
                        reviewsGiven: true,
                        supportTickets: true
                    }
                }
            }
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ user });
    } catch (error) {
        handleControllerError(res, error, 'Failed to fetch user');
    }
};

/**
 * Update user information
 */
export const updateUser = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { firstName, lastName, email, phone } = req.body;

        const user = await prisma.user.update({
            where: { id },
            data: {
                ...(firstName && { firstName }),
                ...(lastName && { lastName }),
                ...(email && { email }),
                ...(phone && { phone })
            }
        });

        res.json({ message: 'User updated successfully', user });
    } catch (error) {
        handleControllerError(res, error, 'Failed to update user');
    }
};

/**
 * Toggle user active status
 */
export const toggleUserStatus = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        const user = await prisma.user.findUnique({ where: { id } });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const newStatus = !user.isActive;

        const updatedUser = await prisma.user.update({
            where: { id },
            data: {
                isActive: newStatus,
                suspendedAt: newStatus ? null : new Date(),
                suspendReason: newStatus ? null : reason
            }
        });

        res.json({
            message: newStatus ? 'User activated' : 'User suspended',
            user: updatedUser
        });
    } catch (error) {
        handleControllerError(res, error, 'Failed to toggle user status');
    }
};

/**
 * Change user role
 */
export const changeUserRole = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { role } = req.body;

        const validRoles = ['CLIENT', 'DRIVER', 'ADMIN'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }

        const user = await prisma.user.update({
            where: { id },
            data: { role }
        });

        // If role is DRIVER, ensure driver profile exists
        if (role === 'DRIVER') {
            const existingProfile = await prisma.driverProfile.findUnique({
                where: { userId: id }
            });
            if (!existingProfile) {
                await prisma.driverProfile.create({
                    data: { userId: id }
                });
            }
        }

        res.json({ message: 'Role updated successfully', user });
    } catch (error) {
        handleControllerError(res, error, 'Failed to change user role');
    }
};

/**
 * Delete user (soft delete by deactivating)
 */
export const deleteUser = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { hardDelete } = req.query;

        if (hardDelete === 'true') {
            // Hard delete - careful with relations
            await prisma.user.delete({ where: { id } });
            res.json({ message: 'User permanently deleted' });
        } else {
            // Soft delete
            await prisma.user.update({
                where: { id },
                data: {
                    isActive: false,
                    suspendedAt: new Date(),
                    suspendReason: 'Account deleted by admin'
                }
            });
            res.json({ message: 'User deactivated' });
        }
    } catch (error) {
        handleControllerError(res, error, 'Failed to delete user');
    }
};

// ============================================
// DRIVER MANAGEMENT
// ============================================

/**
 * Get all drivers with their profiles and stats
 */
export const getAllDrivers = async (req: AuthRequest, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const status = req.query.status as string; // approved, pending, suspended
        const available = req.query.available as string;

        const skip = (page - 1) * limit;

        const where: any = {};

        if (status === 'approved') {
            where.isApproved = true;
        } else if (status === 'pending') {
            where.isApproved = false;
        }

        if (available === 'true') {
            where.isAvailable = true;
        } else if (available === 'false') {
            where.isAvailable = false;
        }

        const [drivers, total] = await Promise.all([
            prisma.driverProfile.findMany({
                where,
                skip,
                take: limit,
                include: {
                    user: {
                        select: {
                            id: true,
                            phone: true,
                            email: true,
                            firstName: true,
                            lastName: true,
                            isActive: true,
                            createdAt: true
                        }
                    },
                    vehicle: true,
                    _count: {
                        select: {
                            ridesAsDriver: true
                        }
                    }
                },
                orderBy: { user: { createdAt: 'desc' } }
            }),
            prisma.driverProfile.count({ where })
        ]);

        res.json({
            drivers,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        handleControllerError(res, error, 'Failed to fetch drivers');
    }
};

/**
 * Get driver details with stats
 */
export const getDriverDetails = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        const driver = await prisma.driverProfile.findUnique({
            where: { id },
            include: {
                user: true,
                vehicle: true,
                ridesAsDriver: {
                    take: 10,
                    orderBy: { createdAt: 'desc' }
                },
                reviewsReceived: {
                    take: 5,
                    orderBy: { id: 'desc' }
                }
            }
        });

        if (!driver) {
            return res.status(404).json({ error: 'Driver not found' });
        }

        // Calculate stats
        const stats = await prisma.ride.aggregate({
            where: {
                driverId: id,
                status: 'COMPLETED'
            },
            _count: true,
            _sum: { finalPrice: true },
            _avg: { finalPrice: true }
        });

        const avgRating = await prisma.review.aggregate({
            where: { driverId: id },
            _avg: { rating: true }
        });

        res.json({
            driver,
            stats: {
                totalRides: stats._count,
                totalRevenue: stats._sum.finalPrice || 0,
                avgRidePrice: stats._avg.finalPrice || 0,
                avgRating: avgRating._avg.rating || 0
            }
        });
    } catch (error) {
        handleControllerError(res, error, 'Failed to fetch driver details');
    }
};

/**
 * Approve a driver
 */
export const approveDriver = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const adminId = req.user?.userId;

        const driver = await prisma.driverProfile.update({
            where: { id },
            data: {
                isApproved: true,
                approvedAt: new Date(),
                approvedBy: adminId
            },
            include: { user: true }
        });

        res.json({ message: 'Driver approved successfully', driver });
    } catch (error) {
        handleControllerError(res, error, 'Failed to approve driver');
    }
};

/**
 * Suspend a driver
 */
export const suspendDriver = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        // Get driver profile to find user
        const driver = await prisma.driverProfile.findUnique({
            where: { id },
            include: { user: true }
        });

        if (!driver) {
            return res.status(404).json({ error: 'Driver not found' });
        }

        // Update both driver and user
        await prisma.$transaction([
            prisma.driverProfile.update({
                where: { id },
                data: {
                    isApproved: false,
                    isAvailable: false
                }
            }),
            prisma.user.update({
                where: { id: driver.userId },
                data: {
                    isActive: false,
                    suspendedAt: new Date(),
                    suspendReason: reason || 'Suspended by admin'
                }
            })
        ]);

        res.json({ message: 'Driver suspended successfully' });
    } catch (error) {
        handleControllerError(res, error, 'Failed to suspend driver');
    }
};

// ============================================
// PLATFORM STATISTICS
// ============================================

/**
 * Get platform-wide statistics
 */
export const getPlatformStats = async (req: AuthRequest, res: Response) => {
    try {
        const [
            totalUsers,
            totalDrivers,
            activeDrivers,
            pendingDrivers,
            totalRides,
            completedRides,
            cancelledRides,
            revenueStats
        ] = await Promise.all([
            prisma.user.count(),
            prisma.driverProfile.count(),
            prisma.driverProfile.count({ where: { isAvailable: true, isApproved: true } }),
            prisma.driverProfile.count({ where: { isApproved: false } }),
            prisma.ride.count(),
            prisma.ride.count({ where: { status: 'COMPLETED' } }),
            prisma.ride.count({ where: { status: 'CANCELLED' } }),
            prisma.ride.aggregate({
                where: { status: 'COMPLETED' },
                _sum: { finalPrice: true }
            })
        ]);

        // Today's stats
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [todayRides, todayRevenue, newUsersToday] = await Promise.all([
            prisma.ride.count({
                where: {
                    createdAt: { gte: today }
                }
            }),
            prisma.ride.aggregate({
                where: {
                    status: 'COMPLETED',
                    completedAt: { gte: today }
                },
                _sum: { finalPrice: true }
            }),
            prisma.user.count({
                where: { createdAt: { gte: today } }
            })
        ]);

        res.json({
            users: {
                total: totalUsers,
                newToday: newUsersToday
            },
            drivers: {
                total: totalDrivers,
                active: activeDrivers,
                pending: pendingDrivers
            },
            rides: {
                total: totalRides,
                completed: completedRides,
                cancelled: cancelledRides,
                today: todayRides,
                completionRate: totalRides > 0 ? ((completedRides / totalRides) * 100).toFixed(1) : 0
            },
            revenue: {
                total: revenueStats._sum.finalPrice || 0,
                today: todayRevenue._sum.finalPrice || 0,
                currency: 'XAF'
            }
        });
    } catch (error) {
        handleControllerError(res, error, 'Failed to fetch platform stats');
    }
};

/**
 * Get revenue statistics by period
 */
export const getRevenueStats = async (req: AuthRequest, res: Response) => {
    try {
        const period = req.query.period as string || 'week'; // day, week, month

        const now = new Date();
        let startDate = new Date();

        if (period === 'day') {
            startDate.setHours(0, 0, 0, 0);
        } else if (period === 'week') {
            startDate.setDate(now.getDate() - 7);
        } else if (period === 'month') {
            startDate.setMonth(now.getMonth() - 1);
        }

        const rides = await prisma.ride.findMany({
            where: {
                status: 'COMPLETED',
                completedAt: {
                    gte: startDate,
                    lte: now
                }
            },
            select: {
                finalPrice: true,
                serviceType: true,
                completedAt: true
            }
        });

        const totalRevenue = rides.reduce((sum, r) => sum + (r.finalPrice || 0), 0);
        const platformCommission = totalRevenue * 0.2; // 20% commission

        // Group by service type
        const byServiceType = rides.reduce((acc: any, r) => {
            if (!acc[r.serviceType]) {
                acc[r.serviceType] = { count: 0, revenue: 0 };
            }
            acc[r.serviceType].count++;
            acc[r.serviceType].revenue += r.finalPrice || 0;
            return acc;
        }, {});

        res.json({
            period,
            startDate,
            endDate: now,
            totalRides: rides.length,
            totalRevenue,
            platformCommission,
            driverEarnings: totalRevenue - platformCommission,
            byServiceType,
            currency: 'XAF'
        });
    } catch (error) {
        handleControllerError(res, error, 'Failed to fetch revenue stats');
    }
};

/**
 * Get active drivers with their locations
 */
export const getActiveDriversMap = async (req: AuthRequest, res: Response) => {
    try {
        const drivers = await prisma.driverProfile.findMany({
            where: {
                isAvailable: true,
                isApproved: true,
                currentLat: { not: null },
                currentLng: { not: null }
            },
            select: {
                id: true,
                currentLat: true,
                currentLng: true,
                user: {
                    select: {
                        firstName: true,
                        lastName: true,
                        phone: true
                    }
                },
                vehicle: {
                    select: {
                        type: true,
                        plateNumber: true
                    }
                }
            }
        });

        res.json({
            count: drivers.length,
            drivers
        });
    } catch (error) {
        handleControllerError(res, error, 'Failed to fetch active drivers');
    }
};

// ============================================
// RIDE MANAGEMENT
// ============================================

/**
 * Get all rides with filters
 */
export const getAllRides = async (req: AuthRequest, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const status = req.query.status as string;
        const serviceType = req.query.serviceType as string;
        const dateFrom = req.query.dateFrom as string;
        const dateTo = req.query.dateTo as string;

        const skip = (page - 1) * limit;

        const where: any = {};

        if (status) where.status = status;
        if (serviceType) where.serviceType = serviceType;

        if (dateFrom || dateTo) {
            where.createdAt = {};
            if (dateFrom) where.createdAt.gte = new Date(dateFrom);
            if (dateTo) where.createdAt.lte = new Date(dateTo);
        }

        const [rides, total] = await Promise.all([
            prisma.ride.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    client: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            phone: true
                        }
                    },
                    driver: {
                        select: {
                            id: true,
                            user: {
                                select: {
                                    firstName: true,
                                    lastName: true,
                                    phone: true
                                }
                            }
                        }
                    }
                }
            }),
            prisma.ride.count({ where })
        ]);

        res.json({
            rides,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        handleControllerError(res, error, 'Failed to fetch rides');
    }
};

/**
 * Get ride details
 */
export const getRideDetails = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        const ride = await prisma.ride.findUnique({
            where: { id },
            include: {
                client: true,
                driver: {
                    include: {
                        user: true,
                        vehicle: true
                    }
                },
                reviews: true
            }
        });

        if (!ride) {
            return res.status(404).json({ error: 'Ride not found' });
        }

        res.json({ ride });
    } catch (error) {
        handleControllerError(res, error, 'Failed to fetch ride details');
    }
};

/**
 * Cancel a ride (admin)
 */
export const cancelRide = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        const ride = await prisma.ride.update({
            where: { id },
            data: {
                status: 'CANCELLED',
                // Could add a cancellation reason field if needed
            }
        });

        res.json({ message: 'Ride cancelled', ride });
    } catch (error) {
        handleControllerError(res, error, 'Failed to cancel ride');
    }
};

// ============================================
// TRANSACTION MANAGEMENT
// ============================================

/**
 * Get all transactions
 */
export const getAllTransactions = async (req: AuthRequest, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const type = req.query.type as string;
        const status = req.query.status as string;

        const skip = (page - 1) * limit;

        const where: any = {};
        if (type) where.type = type;
        if (status) where.status = status;

        const [transactions, total] = await Promise.all([
            prisma.transaction.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    wallet: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    firstName: true,
                                    lastName: true,
                                    phone: true
                                }
                            }
                        }
                    }
                }
            }),
            prisma.transaction.count({ where })
        ]);

        res.json({
            transactions,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        handleControllerError(res, error, 'Failed to fetch transactions');
    }
};

/**
 * Get transaction details
 */
export const getTransactionDetails = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        const transaction = await prisma.transaction.findUnique({
            where: { id },
            include: {
                wallet: {
                    include: {
                        user: true
                    }
                }
            }
        });

        if (!transaction) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        res.json({ transaction });
    } catch (error) {
        handleControllerError(res, error, 'Failed to fetch transaction details');
    }
};
