import { Response } from 'express';
import prisma from '../prisma';
import { AuthRequest } from '../middleware/auth.middleware';
import { handleControllerError } from '../utils/errorHandler';
import { sendNotification } from '../services/notification.service';

// ============================================
// FCM TOKEN MANAGEMENT
// ============================================

// Register FCM token for push notifications
export const registerFcmToken = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        const { fcmToken } = req.body;

        if (!userId) return res.status(401).json({ error: 'Non autorisé' });
        if (!fcmToken) return res.status(400).json({ error: 'fcmToken requis' });

        await prisma.user.update({
            where: { id: userId },
            data: { fcmToken }
        });

        res.json({ message: 'Token FCM enregistré', success: true });
    } catch (error) {
        handleControllerError(res, error, 'Erreur lors de l\'enregistrement du token');
    }
};

// Unregister FCM token (logout)
export const unregisterFcmToken = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ error: 'Non autorisé' });

        await prisma.user.update({
            where: { id: userId },
            data: { fcmToken: null }
        });

        res.json({ message: 'Token FCM supprimé', success: true });
    } catch (error) {
        handleControllerError(res, error, 'Erreur lors de la suppression du token');
    }
};

// ============================================
// NOTIFICATION MANAGEMENT
// ============================================

// Get my notifications
export const getNotifications = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const unreadOnly = req.query.unreadOnly === 'true';

        if (!userId) return res.status(401).json({ error: 'Non autorisé' });

        const skip = (page - 1) * limit;
        const where: any = { userId };
        if (unreadOnly) where.isRead = false;

        const [notifications, total, unreadCount] = await Promise.all([
            prisma.notification.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' }
            }),
            prisma.notification.count({ where }),
            prisma.notification.count({ where: { userId, isRead: false } })
        ]);

        res.json({
            notifications,
            unreadCount,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        handleControllerError(res, error, 'Erreur lors de la récupération des notifications');
    }
};

// Get unread count
export const getUnreadCount = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ error: 'Non autorisé' });

        const count = await prisma.notification.count({
            where: { userId, isRead: false }
        });

        res.json({ unreadCount: count });
    } catch (error) {
        handleControllerError(res, error, 'Erreur lors du comptage');
    }
};

// Mark notification as read
export const markAsRead = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        const { id } = req.params;

        if (!userId) return res.status(401).json({ error: 'Non autorisé' });

        const notification = await prisma.notification.findFirst({
            where: { id, userId }
        });

        if (!notification) {
            return res.status(404).json({ error: 'Notification non trouvée' });
        }

        await prisma.notification.update({
            where: { id },
            data: { isRead: true }
        });

        res.json({ message: 'Notification marquée comme lue' });
    } catch (error) {
        handleControllerError(res, error, 'Erreur lors de la mise à jour');
    }
};

// Mark all as read
export const markAllAsRead = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ error: 'Non autorisé' });

        const result = await prisma.notification.updateMany({
            where: { userId, isRead: false },
            data: { isRead: true }
        });

        res.json({
            message: 'Toutes les notifications marquées comme lues',
            count: result.count
        });
    } catch (error) {
        handleControllerError(res, error, 'Erreur lors de la mise à jour');
    }
};

// Delete old notifications (cleanup)
export const deleteOldNotifications = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ error: 'Non autorisé' });

        // Delete notifications older than 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const result = await prisma.notification.deleteMany({
            where: {
                userId,
                createdAt: { lt: thirtyDaysAgo }
            }
        });

        res.json({
            message: 'Anciennes notifications supprimées',
            count: result.count
        });
    } catch (error) {
        handleControllerError(res, error, 'Erreur lors de la suppression');
    }
};

// ============================================
// BACKOFFICE - SEND NOTIFICATION
// ============================================

// Send notification to user (Admin)
export const sendNotificationToUser = async (req: AuthRequest, res: Response) => {
    try {
        const { userId, title, body, type } = req.body;

        if (!userId || !title || !body) {
            return res.status(400).json({ error: 'userId, title et body requis' });
        }

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({ error: 'Utilisateur non trouvé' });
        }

        const notification = await sendNotification(
            userId,
            title,
            body,
            type || 'SYSTEM'
        );

        res.json({ message: 'Notification envoyée', notification });
    } catch (error) {
        handleControllerError(res, error, 'Erreur lors de l\'envoi');
    }
};

// Send notification to all users (Admin)
export const sendBroadcastNotification = async (req: AuthRequest, res: Response) => {
    try {
        const { title, body, type, role } = req.body;

        if (!title || !body) {
            return res.status(400).json({ error: 'title et body requis' });
        }

        const where: any = {};
        if (role) where.role = role;

        const users = await prisma.user.findMany({
            where,
            select: { id: true }
        });

        const notifications = await Promise.all(
            users.map(user => sendNotification(user.id, title, body, type || 'SYSTEM'))
        );

        res.json({
            message: 'Notification broadcast envoyée',
            count: notifications.length
        });
    } catch (error) {
        handleControllerError(res, error, 'Erreur lors du broadcast');
    }
};
