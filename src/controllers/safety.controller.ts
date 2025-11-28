import { Response } from 'express';
import prisma from '../prisma';
import { AuthRequest } from '../middleware/auth.middleware';

export const addEmergencyContact = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { name, phone } = req.body;
        if (!name || !phone) {
            return res.status(400).json({ error: 'Name and phone are required' });
        }

        const contact = await prisma.emergencyContact.create({
            data: {
                userId,
                name,
                phone,
            }
        });

        res.status(201).json({ message: 'Contact added', contact });
    } catch (error) {
        console.error('Add contact error:', error);
        res.status(500).json({ error: 'Failed to add contact' });
    }
};

export const getEmergencyContacts = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const contacts = await prisma.emergencyContact.findMany({
            where: { userId }
        });

        res.json({ contacts });
    } catch (error) {
        console.error('Get contacts error:', error);
        res.status(500).json({ error: 'Failed to fetch contacts' });
    }
};

export const triggerSOS = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { lat, lng } = req.body;

        // In a real app, this would send SMS/Push to contacts
        const contacts = await prisma.emergencyContact.findMany({
            where: { userId }
        });

        console.log(`[SOS TRIGGERED] User ${userId} at ${lat}, ${lng}`);
        console.log(`[SOS NOTIFYING] ${contacts.length} contacts`);

        res.json({ message: 'SOS alert sent', notifiedCount: contacts.length });
    } catch (error) {
        console.error('SOS error:', error);
        res.status(500).json({ error: 'Failed to trigger SOS' });
    }
};
