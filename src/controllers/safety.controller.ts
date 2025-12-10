import { Response } from 'express';
import prisma from '../prisma';
import { AuthRequest } from '../middleware/auth.middleware';
import { normalizePhone } from '../utils/phoneUtils';
import { handleControllerError } from '../utils/errorHandler';

export const addEmergencyContact = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        const { name, phone } = req.body;

        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (!name || !phone) return res.status(400).json({ error: 'Name and phone required' });

        const contact = await prisma.emergencyContact.create({
            data: { userId, name, phone: normalizePhone(phone) }
        });

        res.status(201).json({ message: 'Contact added', contact });
    } catch (error) {
        handleControllerError(res, error, 'Failed to add contact');
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
        handleControllerError(res, error, 'Failed to fetch contacts');
    }
};

export const triggerSOS = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        const { latitude, longitude } = req.body;

        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        // In a real app, this would integrate with SMS/Push notifications
        // For now, we just log it and return success
        console.log(`SOS Triggered by user ${userId} at ${latitude}, ${longitude}`);

        const contacts = await prisma.emergencyContact.findMany({
            where: { userId }
        });

        // Simulate sending alerts
        contacts.forEach(contact => {
            console.log(`Alerting ${contact.name} (${contact.phone})...`);
        });

        res.json({ message: 'SOS Alert sent', contactsAlerted: contacts.length });
    } catch (error) {
        handleControllerError(res, error, 'Failed to trigger SOS');
    }
};
