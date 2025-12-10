import { Response } from 'express';
import prisma from '../prisma';
import { AuthRequest } from '../middleware/auth.middleware';

import { handleControllerError } from '../utils/errorHandler';

export const createTicket = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        const { subject, description, category } = req.body;

        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (!subject || !description || !category) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const ticket = await prisma.supportTicket.create({
            data: {
                userId,
                subject,
                description,
                category
            }
        });

        res.status(201).json({ message: 'Ticket created', ticket });
    } catch (error) {
        handleControllerError(res, error, 'Failed to create ticket');
    }
};

export const getTickets = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const tickets = await prisma.supportTicket.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' }
        });

        res.json({ tickets });
    } catch (error) {
        handleControllerError(res, error, 'Failed to fetch tickets');
    }
};
