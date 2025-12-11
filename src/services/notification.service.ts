import admin from 'firebase-admin';
import prisma from '../prisma';
import { getIO } from '../socket';

// Type definitions
type NotificationType = 'RIDE' | 'PROMO' | 'REFERRAL' | 'DOCUMENT' | 'PAYMENT' | 'SYSTEM';

interface NotificationPayload {
    title: string;
    body: string;
    data?: Record<string, string>;
}

// Initialize Firebase Admin SDK
let firebaseInitialized = false;

export const initializeFirebase = () => {
    if (firebaseInitialized) return;

    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;

    if (serviceAccount) {
        try {
            const parsedAccount = JSON.parse(serviceAccount);
            admin.initializeApp({
                credential: admin.credential.cert(parsedAccount)
            });
            firebaseInitialized = true;
            console.log('✅ Firebase Admin SDK initialized');
        } catch (error) {
            console.warn('⚠️ Failed to initialize Firebase Admin SDK:', error);
            console.warn('Push notifications will be stored but not sent via FCM');
        }
    } else {
        console.warn('⚠️ FIREBASE_SERVICE_ACCOUNT not set. Push notifications will be stored only.');
    }
};

// Save notification to database
const saveNotification = async (
    userId: string,
    title: string,
    body: string,
    type: NotificationType,
    data?: Record<string, any>
) => {
    return await prisma.notification.create({
        data: {
            userId,
            title,
            body,
            type,
            data: data ? data : undefined
        }
    });
};

// Send push notification via FCM
const sendFCMNotification = async (
    fcmToken: string,
    payload: NotificationPayload
) => {
    if (!firebaseInitialized) return false;

    try {
        await admin.messaging().send({
            token: fcmToken,
            notification: {
                title: payload.title,
                body: payload.body
            },
            data: payload.data || {},
            android: {
                priority: 'high',
                notification: {
                    sound: 'default',
                    channelId: 'afrigo_notifications'
                }
            },
            apns: {
                payload: {
                    aps: {
                        sound: 'default',
                        badge: 1
                    }
                }
            }
        });
        return true;
    } catch (error: any) {
        // Handle invalid token
        if (error.code === 'messaging/registration-token-not-registered' ||
            error.code === 'messaging/invalid-registration-token') {
            console.log('Invalid FCM token, will be cleaned up');
            return false;
        }
        console.error('FCM send error:', error);
        return false;
    }
};

// Emit via Socket.IO for real-time
const emitSocketNotification = (userId: string, notification: any) => {
    try {
        const io = getIO();
        io.to(`user_${userId}`).emit('notification', notification);
    } catch (error) {
        // Socket might not be initialized
    }
};

// ============================================
// MAIN NOTIFICATION FUNCTIONS
// ============================================

export const sendNotification = async (
    userId: string,
    title: string,
    body: string,
    type: NotificationType,
    data?: Record<string, any>
) => {
    // Save to database
    const notification = await saveNotification(userId, title, body, type, data);

    // Emit via Socket.IO
    emitSocketNotification(userId, notification);

    // Get user's FCM token
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { fcmToken: true }
    });

    // Send push if token exists
    if (user?.fcmToken) {
        const dataStrings = data ?
            Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])) :
            undefined;
        await sendFCMNotification(user.fcmToken, { title, body, data: dataStrings });
    }

    return notification;
};

export const sendToMultipleUsers = async (
    userIds: string[],
    title: string,
    body: string,
    type: NotificationType,
    data?: Record<string, any>
) => {
    const results = await Promise.all(
        userIds.map(userId => sendNotification(userId, title, body, type, data))
    );
    return results;
};

// ============================================
// RIDE NOTIFICATIONS
// ============================================

export const notifyRideAccepted = async (
    clientId: string,
    driverName: string,
    etaMinutes?: number
) => {
    const eta = etaMinutes ? ` dans ~${etaMinutes} min` : '';
    return sendNotification(
        clientId,
        'Chauffeur en route 🚗',
        `${driverName} arrive${eta}`,
        'RIDE',
        { event: 'RIDE_ACCEPTED' }
    );
};

export const notifyDriverArrived = async (clientId: string) => {
    return sendNotification(
        clientId,
        'Chauffeur arrivé! 📍',
        'Votre chauffeur vous attend',
        'RIDE',
        { event: 'DRIVER_ARRIVED' }
    );
};

export const notifyRideStarted = async (clientId: string) => {
    return sendNotification(
        clientId,
        'Course en cours 🛣️',
        'Bonne route! Votre course a commencé',
        'RIDE',
        { event: 'RIDE_STARTED' }
    );
};

export const notifyRideCompleted = async (
    userId: string,
    amount: number,
    isDriver: boolean = false
) => {
    const title = isDriver ? 'Course terminée! 💰' : 'Course terminée! ✅';
    const body = isDriver
        ? `Paiement reçu: ${amount} XAF`
        : `Montant: ${amount} XAF. Merci d'avoir voyagé avec Afrigo!`;

    return sendNotification(
        userId,
        title,
        body,
        'RIDE',
        { event: 'RIDE_COMPLETED', amount: String(amount) }
    );
};

export const notifyRideCancelled = async (
    driverId: string,
    reason?: string
) => {
    return sendNotification(
        driverId,
        'Course annulée ❌',
        reason || 'Le client a annulé la course',
        'RIDE',
        { event: 'RIDE_CANCELLED' }
    );
};

export const notifyNewRideAvailable = async (
    driverIds: string[],
    origin: string,
    estimatedPrice: number
) => {
    return sendToMultipleUsers(
        driverIds,
        'Nouvelle course 📍',
        `Course disponible: ${origin} (~${estimatedPrice} XAF)`,
        'RIDE',
        { event: 'NEW_RIDE' }
    );
};

// ============================================
// PAYMENT NOTIFICATIONS
// ============================================

export const notifyPaymentReceived = async (
    driverId: string,
    amount: number
) => {
    return sendNotification(
        driverId,
        'Paiement reçu 💰',
        `+${amount} XAF crédité sur votre wallet`,
        'PAYMENT',
        { event: 'PAYMENT_RECEIVED', amount: String(amount) }
    );
};

// ============================================
// REFERRAL NOTIFICATIONS
// ============================================

export const notifyReferralBonus = async (
    userId: string,
    amount: number,
    isReferrer: boolean = false
) => {
    const title = 'Bonus parrainage! 🎉';
    const body = isReferrer
        ? `Merci! +${amount} XAF pour votre parrainage`
        : `Bienvenue! +${amount} XAF offerts`;

    return sendNotification(
        userId,
        title,
        body,
        'REFERRAL',
        { event: 'REFERRAL_BONUS', amount: String(amount) }
    );
};

// ============================================
// PROMO NOTIFICATIONS
// ============================================

export const notifyPromoApplied = async (
    userId: string,
    code: string,
    discount: number
) => {
    return sendNotification(
        userId,
        'Code promo appliqué! 🎟️',
        `${code}: -${discount} XAF sur votre course`,
        'PROMO',
        { event: 'PROMO_APPLIED', code, discount: String(discount) }
    );
};

// ============================================
// DOCUMENT NOTIFICATIONS (Drivers)
// ============================================

export const notifyDocumentApproved = async (
    driverId: string,
    documentType: string
) => {
    return sendNotification(
        driverId,
        'Document validé ✅',
        `Votre ${documentType} a été approuvé`,
        'DOCUMENT',
        { event: 'DOCUMENT_APPROVED', documentType }
    );
};

export const notifyDocumentRejected = async (
    driverId: string,
    documentType: string,
    reason?: string
) => {
    return sendNotification(
        driverId,
        'Document refusé ❌',
        `${documentType} refusé${reason ? `: ${reason}` : ''}`,
        'DOCUMENT',
        { event: 'DOCUMENT_REJECTED', documentType, reason: reason || '' }
    );
};

export const notifyAccountApproved = async (driverId: string) => {
    return sendNotification(
        driverId,
        'Compte activé! 🚗',
        'Félicitations! Votre compte chauffeur est maintenant actif',
        'SYSTEM',
        { event: 'ACCOUNT_APPROVED' }
    );
};

export const notifyAccountSuspended = async (
    userId: string,
    reason?: string
) => {
    return sendNotification(
        userId,
        'Compte suspendu ⚠️',
        reason || 'Veuillez contacter le support',
        'SYSTEM',
        { event: 'ACCOUNT_SUSPENDED', reason: reason || '' }
    );
};
