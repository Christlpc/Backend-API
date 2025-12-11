import { Response } from 'express';
import prisma from '../prisma';
import { AuthRequest } from '../middleware/auth.middleware';
import { handleControllerError } from '../utils/errorHandler';

// ============================================
// BACKOFFICE - PROMO CODE MANAGEMENT
// ============================================

// Create a new promo code
export const createPromoCode = async (req: AuthRequest, res: Response) => {
    try {
        const {
            code,
            description,
            discountType,
            discountValue,
            maxUses,
            maxUsesPerUser,
            minRideAmount,
            startsAt,
            expiresAt,
            serviceTypes
        } = req.body;

        // Validation
        if (!code || !discountType || discountValue === undefined) {
            return res.status(400).json({ error: 'Code, discountType et discountValue sont requis' });
        }

        if (!['PERCENTAGE', 'FIXED'].includes(discountType)) {
            return res.status(400).json({ error: 'discountType doit être PERCENTAGE ou FIXED' });
        }

        if (discountType === 'PERCENTAGE' && (discountValue < 0 || discountValue > 100)) {
            return res.status(400).json({ error: 'Le pourcentage doit être entre 0 et 100' });
        }

        // Check if code already exists
        const existingCode = await prisma.promoCode.findUnique({ where: { code: code.toUpperCase() } });
        if (existingCode) {
            return res.status(409).json({ error: 'Ce code promo existe déjà' });
        }

        const promoCode = await prisma.promoCode.create({
            data: {
                code: code.toUpperCase(),
                description,
                discountType,
                discountValue,
                maxUses: maxUses || null,
                maxUsesPerUser: maxUsesPerUser || 1,
                minRideAmount: minRideAmount || null,
                startsAt: startsAt ? new Date(startsAt) : new Date(),
                expiresAt: expiresAt ? new Date(expiresAt) : null,
                serviceTypes: serviceTypes || []
            }
        });

        res.status(201).json({ message: 'Code promo créé avec succès', promoCode });
    } catch (error) {
        handleControllerError(res, error, 'Erreur lors de la création du code promo');
    }
};

// Get all promo codes with pagination
export const getAllPromoCodes = async (req: AuthRequest, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const status = req.query.status as string; // active, inactive, expired
        const search = req.query.search as string;

        const skip = (page - 1) * limit;

        const where: any = {};

        if (status === 'active') {
            where.isActive = true;
            where.OR = [
                { expiresAt: null },
                { expiresAt: { gt: new Date() } }
            ];
        } else if (status === 'inactive') {
            where.isActive = false;
        } else if (status === 'expired') {
            where.expiresAt = { lt: new Date() };
        }

        if (search) {
            where.OR = [
                { code: { contains: search.toUpperCase() } },
                { description: { contains: search, mode: 'insensitive' } }
            ];
        }

        const [promoCodes, total] = await Promise.all([
            prisma.promoCode.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    _count: {
                        select: { usages: true }
                    }
                }
            }),
            prisma.promoCode.count({ where })
        ]);

        res.json({
            promoCodes: promoCodes.map(p => ({
                ...p,
                usageCount: p._count.usages
            })),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        handleControllerError(res, error, 'Erreur lors de la récupération des codes promo');
    }
};

// Get promo code by ID
export const getPromoCodeById = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        const promoCode = await prisma.promoCode.findUnique({
            where: { id },
            include: {
                usages: {
                    orderBy: { createdAt: 'desc' },
                    take: 50
                },
                _count: {
                    select: { usages: true }
                }
            }
        });

        if (!promoCode) {
            return res.status(404).json({ error: 'Code promo non trouvé' });
        }

        res.json({
            ...promoCode,
            usageCount: promoCode._count.usages
        });
    } catch (error) {
        handleControllerError(res, error, 'Erreur lors de la récupération du code promo');
    }
};

// Update promo code
export const updatePromoCode = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const {
            description,
            discountType,
            discountValue,
            maxUses,
            maxUsesPerUser,
            minRideAmount,
            startsAt,
            expiresAt,
            serviceTypes
        } = req.body;

        const existingCode = await prisma.promoCode.findUnique({ where: { id } });
        if (!existingCode) {
            return res.status(404).json({ error: 'Code promo non trouvé' });
        }

        if (discountType && !['PERCENTAGE', 'FIXED'].includes(discountType)) {
            return res.status(400).json({ error: 'discountType doit être PERCENTAGE ou FIXED' });
        }

        const promoCode = await prisma.promoCode.update({
            where: { id },
            data: {
                description: description !== undefined ? description : undefined,
                discountType: discountType || undefined,
                discountValue: discountValue !== undefined ? discountValue : undefined,
                maxUses: maxUses !== undefined ? maxUses : undefined,
                maxUsesPerUser: maxUsesPerUser !== undefined ? maxUsesPerUser : undefined,
                minRideAmount: minRideAmount !== undefined ? minRideAmount : undefined,
                startsAt: startsAt ? new Date(startsAt) : undefined,
                expiresAt: expiresAt !== undefined ? (expiresAt ? new Date(expiresAt) : null) : undefined,
                serviceTypes: serviceTypes !== undefined ? serviceTypes : undefined
            }
        });

        res.json({ message: 'Code promo mis à jour', promoCode });
    } catch (error) {
        handleControllerError(res, error, 'Erreur lors de la mise à jour du code promo');
    }
};

// Toggle promo code active status
export const togglePromoCode = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        const existingCode = await prisma.promoCode.findUnique({ where: { id } });
        if (!existingCode) {
            return res.status(404).json({ error: 'Code promo non trouvé' });
        }

        const promoCode = await prisma.promoCode.update({
            where: { id },
            data: { isActive: !existingCode.isActive }
        });

        res.json({
            message: `Code promo ${promoCode.isActive ? 'activé' : 'désactivé'}`,
            promoCode
        });
    } catch (error) {
        handleControllerError(res, error, 'Erreur lors de la modification du statut');
    }
};

// Delete promo code
export const deletePromoCode = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        const existingCode = await prisma.promoCode.findUnique({
            where: { id },
            include: { _count: { select: { usages: true } } }
        });

        if (!existingCode) {
            return res.status(404).json({ error: 'Code promo non trouvé' });
        }

        // If code has been used, soft delete (deactivate)
        if (existingCode._count.usages > 0) {
            await prisma.promoCode.update({
                where: { id },
                data: { isActive: false }
            });
            return res.json({ message: 'Code promo désactivé (a été utilisé, conservation pour historique)' });
        }

        // Hard delete if never used
        await prisma.promoCode.delete({ where: { id } });
        res.json({ message: 'Code promo supprimé' });
    } catch (error) {
        handleControllerError(res, error, 'Erreur lors de la suppression du code promo');
    }
};

// Get promo code statistics
export const getPromoCodeStats = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        const promoCode = await prisma.promoCode.findUnique({
            where: { id },
            include: {
                usages: true
            }
        });

        if (!promoCode) {
            return res.status(404).json({ error: 'Code promo non trouvé' });
        }

        const totalUsages = promoCode.usages.length;
        const totalDiscountGiven = promoCode.usages.reduce((sum, u) => sum + u.discountApplied, 0);
        const uniqueUsers = new Set(promoCode.usages.map(u => u.userId)).size;

        res.json({
            code: promoCode.code,
            totalUsages,
            uniqueUsers,
            totalDiscountGiven,
            maxUses: promoCode.maxUses,
            remainingUses: promoCode.maxUses ? promoCode.maxUses - totalUsages : 'illimité',
            isActive: promoCode.isActive,
            expiresAt: promoCode.expiresAt
        });
    } catch (error) {
        handleControllerError(res, error, 'Erreur lors de la récupération des statistiques');
    }
};

// ============================================
// CLIENT - PROMO CODE USAGE
// ============================================

// Validate a promo code (before applying)
export const validatePromoCode = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        const { code, rideAmount, serviceType } = req.body;

        if (!userId) return res.status(401).json({ error: 'Non autorisé' });
        if (!code) return res.status(400).json({ error: 'Code requis' });

        const promoCode = await prisma.promoCode.findUnique({
            where: { code: code.toUpperCase() }
        });

        if (!promoCode) {
            return res.status(404).json({ valid: false, error: 'Code promo invalide' });
        }

        // Check if active
        if (!promoCode.isActive) {
            return res.status(400).json({ valid: false, error: 'Ce code promo n\'est plus actif' });
        }

        // Check dates
        const now = new Date();
        if (promoCode.startsAt > now) {
            return res.status(400).json({ valid: false, error: 'Ce code promo n\'est pas encore valide' });
        }
        if (promoCode.expiresAt && promoCode.expiresAt < now) {
            return res.status(400).json({ valid: false, error: 'Ce code promo a expiré' });
        }

        // Check max uses
        if (promoCode.maxUses && promoCode.usedCount >= promoCode.maxUses) {
            return res.status(400).json({ valid: false, error: 'Ce code promo a atteint sa limite d\'utilisation' });
        }

        // Check user usage limit
        const userUsages = await prisma.promoCodeUsage.count({
            where: { promoCodeId: promoCode.id, userId }
        });
        if (userUsages >= promoCode.maxUsesPerUser) {
            return res.status(400).json({ valid: false, error: 'Vous avez déjà utilisé ce code promo' });
        }

        // Check minimum ride amount
        if (rideAmount && promoCode.minRideAmount && rideAmount < promoCode.minRideAmount) {
            return res.status(400).json({
                valid: false,
                error: `Montant minimum de course requis: ${promoCode.minRideAmount} XAF`
            });
        }

        // Check service type restriction
        if (serviceType && promoCode.serviceTypes.length > 0 && !promoCode.serviceTypes.includes(serviceType)) {
            return res.status(400).json({
                valid: false,
                error: `Ce code n'est pas valide pour le service ${serviceType}`
            });
        }

        // Calculate discount
        let discount = 0;
        if (rideAmount) {
            if (promoCode.discountType === 'PERCENTAGE') {
                discount = Math.round(rideAmount * promoCode.discountValue / 100);
            } else {
                discount = Math.min(promoCode.discountValue, rideAmount);
            }
        }

        res.json({
            valid: true,
            promoCode: {
                code: promoCode.code,
                description: promoCode.description,
                discountType: promoCode.discountType,
                discountValue: promoCode.discountValue
            },
            estimatedDiscount: discount,
            finalAmount: rideAmount ? rideAmount - discount : null
        });
    } catch (error) {
        handleControllerError(res, error, 'Erreur lors de la validation du code promo');
    }
};

// Apply a promo code to a ride (called during ride creation)
export const applyPromoCode = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        const { code, rideId, rideAmount, serviceType } = req.body;

        if (!userId) return res.status(401).json({ error: 'Non autorisé' });
        if (!code || !rideAmount) {
            return res.status(400).json({ error: 'Code et montant de course requis' });
        }

        const promoCode = await prisma.promoCode.findUnique({
            where: { code: code.toUpperCase() }
        });

        if (!promoCode) {
            return res.status(404).json({ error: 'Code promo invalide' });
        }

        // All validations from validatePromoCode
        if (!promoCode.isActive) {
            return res.status(400).json({ error: 'Ce code promo n\'est plus actif' });
        }

        const now = new Date();
        if (promoCode.startsAt > now || (promoCode.expiresAt && promoCode.expiresAt < now)) {
            return res.status(400).json({ error: 'Ce code promo n\'est pas valide actuellement' });
        }

        if (promoCode.maxUses && promoCode.usedCount >= promoCode.maxUses) {
            return res.status(400).json({ error: 'Ce code promo a atteint sa limite d\'utilisation' });
        }

        const userUsages = await prisma.promoCodeUsage.count({
            where: { promoCodeId: promoCode.id, userId }
        });
        if (userUsages >= promoCode.maxUsesPerUser) {
            return res.status(400).json({ error: 'Vous avez déjà utilisé ce code promo' });
        }

        if (promoCode.minRideAmount && rideAmount < promoCode.minRideAmount) {
            return res.status(400).json({ error: `Montant minimum requis: ${promoCode.minRideAmount} XAF` });
        }

        if (serviceType && promoCode.serviceTypes.length > 0 && !promoCode.serviceTypes.includes(serviceType)) {
            return res.status(400).json({ error: `Ce code n'est pas valide pour ce service` });
        }

        // Calculate discount
        let discount: number;
        if (promoCode.discountType === 'PERCENTAGE') {
            discount = Math.round(rideAmount * promoCode.discountValue / 100);
        } else {
            discount = Math.min(promoCode.discountValue, rideAmount);
        }

        // Record usage and update count
        await prisma.$transaction([
            prisma.promoCodeUsage.create({
                data: {
                    promoCodeId: promoCode.id,
                    userId,
                    rideId: rideId || null,
                    discountApplied: discount
                }
            }),
            prisma.promoCode.update({
                where: { id: promoCode.id },
                data: { usedCount: { increment: 1 } }
            })
        ]);

        res.json({
            success: true,
            discount,
            originalAmount: rideAmount,
            finalAmount: rideAmount - discount,
            message: `Réduction de ${discount} XAF appliquée`
        });
    } catch (error) {
        handleControllerError(res, error, 'Erreur lors de l\'application du code promo');
    }
};
