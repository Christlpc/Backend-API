import { Response } from 'express';
import prisma from '../prisma';
import { AuthRequest } from '../middleware/auth.middleware';
import { handleControllerError } from '../utils/errorHandler';

// Helper to generate a unique referral code
const generateReferralCode = (userId: string): string => {
    const prefix = 'AFRIGO';
    const uniquePart = userId.slice(-6).toUpperCase();
    const randomPart = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `${prefix}${uniquePart}${randomPart}`;
};

// Helper to get or create referral config
const getReferralConfigData = async () => {
    let config = await prisma.referralConfig.findFirst();
    if (!config) {
        config = await prisma.referralConfig.create({
            data: {
                referrerBonus: 500,
                refereeBonus: 500,
                minRidesForBonus: 1,
                isActive: true
            }
        });
    }
    return config;
};

// Helper to ensure wallet exists
const ensureWallet = async (userId: string) => {
    let wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
        wallet = await prisma.wallet.create({ data: { userId } });
    }
    return wallet;
};

// ============================================
// USER ENDPOINTS
// ============================================

// Get or generate my referral code
export const getMyReferralCode = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ error: 'Non autorisé' });

        let user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, referralCode: true, firstName: true }
        });

        if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });

        // Generate code if not exists
        if (!user.referralCode) {
            let newCode = generateReferralCode(userId);

            // Ensure uniqueness
            let attempts = 0;
            while (attempts < 5) {
                const existing = await prisma.user.findUnique({ where: { referralCode: newCode } });
                if (!existing) break;
                newCode = generateReferralCode(userId);
                attempts++;
            }

            user = await prisma.user.update({
                where: { id: userId },
                data: { referralCode: newCode },
                select: { id: true, referralCode: true, firstName: true }
            });
        }

        // Get referral stats
        const referrals = await prisma.referral.findMany({
            where: { referrerId: userId }
        });

        const completed = referrals.filter(r => r.status === 'COMPLETED').length;
        const pending = referrals.filter(r => r.status === 'PENDING').length;
        const totalEarned = referrals.reduce((sum, r) => sum + r.referrerBonus, 0);

        res.json({
            referralCode: user.referralCode,
            shareMessage: `Rejoins Afrigo avec mon code ${user.referralCode} et reçois un bonus sur ta première course! 🚗`,
            stats: {
                totalReferrals: referrals.length,
                completedReferrals: completed,
                pendingReferrals: pending,
                totalEarned
            }
        });
    } catch (error) {
        handleControllerError(res, error, 'Erreur lors de la récupération du code de parrainage');
    }
};

// Apply a referral code (new user only)
export const applyReferralCode = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        const { code } = req.body;

        if (!userId) return res.status(401).json({ error: 'Non autorisé' });
        if (!code) return res.status(400).json({ error: 'Code de parrainage requis' });

        // Check if referral system is active
        const config = await getReferralConfigData();
        if (!config.isActive) {
            return res.status(400).json({ error: 'Le système de parrainage est actuellement désactivé' });
        }

        // Get current user
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });

        // Check if user already has a referrer
        if (user.referredBy) {
            return res.status(400).json({ error: 'Vous avez déjà utilisé un code de parrainage' });
        }

        // Check if user already has rides (not really "new")
        const userRides = await prisma.ride.count({ where: { clientId: userId } });
        if (userRides > 0) {
            return res.status(400).json({ error: 'Le code de parrainage ne peut être utilisé que par les nouveaux utilisateurs' });
        }

        // Find referrer by code
        const referrer = await prisma.user.findUnique({
            where: { referralCode: code.toUpperCase() }
        });

        if (!referrer) {
            return res.status(404).json({ error: 'Code de parrainage invalide' });
        }

        // Cannot refer yourself
        if (referrer.id === userId) {
            return res.status(400).json({ error: 'Vous ne pouvez pas utiliser votre propre code' });
        }

        // Check if referral already exists
        const existingReferral = await prisma.referral.findUnique({
            where: { refereeId: userId }
        });
        if (existingReferral) {
            return res.status(400).json({ error: 'Parrainage déjà enregistré' });
        }

        // Create referral record
        await prisma.$transaction(async (tx) => {
            // Update user with referrer
            await tx.user.update({
                where: { id: userId },
                data: { referredBy: referrer.id }
            });

            // Create referral record
            await tx.referral.create({
                data: {
                    referrerId: referrer.id,
                    refereeId: userId,
                    status: 'PENDING',
                    referrerBonus: 0,
                    refereeBonus: 0
                }
            });
        });

        res.json({
            success: true,
            message: `Code de parrainage appliqué! Vous recevrez ${config.refereeBonus} XAF après votre première course.`,
            referrer: {
                firstName: referrer.firstName
            },
            bonusAmount: config.refereeBonus
        });
    } catch (error) {
        handleControllerError(res, error, 'Erreur lors de l\'application du code de parrainage');
    }
};

// Get my referrals list
export const getMyReferrals = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ error: 'Non autorisé' });

        const referrals = await prisma.referral.findMany({
            where: { referrerId: userId },
            orderBy: { createdAt: 'desc' }
        });

        // Get referee details
        const refereeIds = referrals.map(r => r.refereeId);
        const referees = await prisma.user.findMany({
            where: { id: { in: refereeIds } },
            select: { id: true, firstName: true, lastName: true, createdAt: true }
        });

        const refereeMap = new Map(referees.map(r => [r.id, r]));

        const formattedReferrals = referrals.map(r => ({
            id: r.id,
            referee: {
                id: r.refereeId,
                firstName: refereeMap.get(r.refereeId)?.firstName || 'Inconnu',
                lastName: refereeMap.get(r.refereeId)?.lastName?.charAt(0) || '',
                joinedAt: refereeMap.get(r.refereeId)?.createdAt
            },
            status: r.status,
            bonus: r.referrerBonus,
            createdAt: r.createdAt,
            completedAt: r.completedAt
        }));

        res.json({ referrals: formattedReferrals });
    } catch (error) {
        handleControllerError(res, error, 'Erreur lors de la récupération des parrainages');
    }
};

// Process referral bonus (called internally when ride is completed)
export const processReferralBonus = async (userId: string, rideId: string) => {
    try {
        // Check if user has a pending referral
        const referral = await prisma.referral.findUnique({
            where: { refereeId: userId }
        });

        if (!referral || referral.status !== 'PENDING') return;

        // Get config
        const config = await getReferralConfigData();
        if (!config.isActive) return;

        // Count user's completed rides
        const completedRides = await prisma.ride.count({
            where: {
                clientId: userId,
                status: 'COMPLETED'
            }
        });

        // Check if minimum rides reached
        if (completedRides < config.minRidesForBonus) return;

        // Award bonuses
        await prisma.$transaction(async (tx) => {
            // Update referral status
            await tx.referral.update({
                where: { id: referral.id },
                data: {
                    status: 'COMPLETED',
                    referrerBonus: config.referrerBonus,
                    refereeBonus: config.refereeBonus,
                    bonusPaidAt: new Date(),
                    completedAt: new Date()
                }
            });

            // Add bonus to referrer wallet
            const referrerWallet = await ensureWallet(referral.referrerId);
            await tx.wallet.update({
                where: { id: referrerWallet.id },
                data: { balance: { increment: config.referrerBonus } }
            });
            await tx.transaction.create({
                data: {
                    walletId: referrerWallet.id,
                    amount: config.referrerBonus,
                    type: 'DEPOSIT',
                    status: 'COMPLETED',
                    description: 'Bonus de parrainage'
                }
            });

            // Add bonus to referee wallet
            const refereeWallet = await ensureWallet(userId);
            await tx.wallet.update({
                where: { id: refereeWallet.id },
                data: { balance: { increment: config.refereeBonus } }
            });
            await tx.transaction.create({
                data: {
                    walletId: refereeWallet.id,
                    amount: config.refereeBonus,
                    type: 'DEPOSIT',
                    status: 'COMPLETED',
                    description: 'Bonus de bienvenue (parrainage)'
                }
            });
        });

        console.log(`Referral bonus processed for user ${userId}, referrer ${referral.referrerId}`);
    } catch (error) {
        console.error('Error processing referral bonus:', error);
    }
};

// ============================================
// BACKOFFICE ENDPOINTS
// ============================================

// Get referral statistics
export const getReferralStats = async (req: AuthRequest, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const status = req.query.status as string;
        const skip = (page - 1) * limit;

        const where: any = {};
        if (status) where.status = status;

        const [referrals, total, stats] = await Promise.all([
            prisma.referral.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' }
            }),
            prisma.referral.count({ where }),
            prisma.referral.aggregate({
                _count: true,
                _sum: {
                    referrerBonus: true,
                    refereeBonus: true
                }
            })
        ]);

        // Get user details
        const userIds = [...new Set(referrals.flatMap(r => [r.referrerId, r.refereeId]))];
        const users = await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, firstName: true, lastName: true, phone: true }
        });
        const userMap = new Map(users.map(u => [u.id, u]));

        const formattedReferrals = referrals.map(r => ({
            id: r.id,
            referrer: userMap.get(r.referrerId) || { id: r.referrerId },
            referee: userMap.get(r.refereeId) || { id: r.refereeId },
            status: r.status,
            referrerBonus: r.referrerBonus,
            refereeBonus: r.refereeBonus,
            createdAt: r.createdAt,
            completedAt: r.completedAt
        }));

        const completedCount = await prisma.referral.count({ where: { status: 'COMPLETED' } });
        const pendingCount = await prisma.referral.count({ where: { status: 'PENDING' } });

        res.json({
            referrals: formattedReferrals,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            },
            summary: {
                totalReferrals: stats._count,
                completedReferrals: completedCount,
                pendingReferrals: pendingCount,
                totalReferrerBonusPaid: stats._sum.referrerBonus || 0,
                totalRefereeBonusPaid: stats._sum.refereeBonus || 0,
                totalBonusPaid: (stats._sum.referrerBonus || 0) + (stats._sum.refereeBonus || 0)
            }
        });
    } catch (error) {
        handleControllerError(res, error, 'Erreur lors de la récupération des statistiques');
    }
};

// Get referral config
export const getReferralConfig = async (req: AuthRequest, res: Response) => {
    try {
        const config = await getReferralConfigData();
        res.json(config);
    } catch (error) {
        handleControllerError(res, error, 'Erreur lors de la récupération de la configuration');
    }
};

// Update referral config
export const updateReferralConfig = async (req: AuthRequest, res: Response) => {
    try {
        const { referrerBonus, refereeBonus, minRidesForBonus, isActive } = req.body;

        // Validation
        if (referrerBonus !== undefined && referrerBonus < 0) {
            return res.status(400).json({ error: 'Le bonus parrain doit être positif' });
        }
        if (refereeBonus !== undefined && refereeBonus < 0) {
            return res.status(400).json({ error: 'Le bonus filleul doit être positif' });
        }
        if (minRidesForBonus !== undefined && minRidesForBonus < 1) {
            return res.status(400).json({ error: 'Le nombre minimum de courses doit être au moins 1' });
        }

        let config = await prisma.referralConfig.findFirst();

        if (config) {
            config = await prisma.referralConfig.update({
                where: { id: config.id },
                data: {
                    referrerBonus: referrerBonus !== undefined ? referrerBonus : undefined,
                    refereeBonus: refereeBonus !== undefined ? refereeBonus : undefined,
                    minRidesForBonus: minRidesForBonus !== undefined ? minRidesForBonus : undefined,
                    isActive: isActive !== undefined ? isActive : undefined
                }
            });
        } else {
            config = await prisma.referralConfig.create({
                data: {
                    referrerBonus: referrerBonus || 500,
                    refereeBonus: refereeBonus || 500,
                    minRidesForBonus: minRidesForBonus || 1,
                    isActive: isActive !== undefined ? isActive : true
                }
            });
        }

        res.json({ message: 'Configuration mise à jour', config });
    } catch (error) {
        handleControllerError(res, error, 'Erreur lors de la mise à jour de la configuration');
    }
};
