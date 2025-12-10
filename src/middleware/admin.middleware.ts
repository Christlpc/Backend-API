import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';

/**
 * Middleware to check if the authenticated user is an admin.
 * Must be used after the authenticate middleware.
 */
export const isAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    if (req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    }

    next();
};
