import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../prisma';
import { handleControllerError } from '../utils/errorHandler';
import { normalizePhone, isValidPhone } from '../utils/phoneUtils';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

export const register = async (req: Request, res: Response) => {
    try {
        const { phone, email, password, firstName, lastName } = req.body;

        if (!phone || !password) {
            return res.status(400).json({ error: 'Phone and password are required' });
        }

        const normalizedPhone = normalizePhone(phone);

        if (!isValidPhone(normalizedPhone)) {
            return res.status(400).json({ error: 'Invalid phone number format' });
        }

        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [
                    { phone: normalizedPhone },
                    { email: email || undefined }
                ]
            }
        });

        if (existingUser) {
            return res.status(409).json({ error: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: {
                phone: normalizedPhone,
                email,
                password: hashedPassword,
                firstName,
                lastName,
            },
        });

        res.status(201).json({ message: 'User registered successfully', userId: user.id });
    } catch (error) {
        handleControllerError(res, error, 'Registration failed');
    }
};

export const login = async (req: Request, res: Response) => {
    try {
        const { phone, password } = req.body;

        if (!phone || !password) {
            return res.status(400).json({ error: 'Phone and password are required' });
        }

        const normalizedPhone = normalizePhone(phone);

        const user = await prisma.user.findUnique({
            where: { phone: normalizedPhone },
        });

        if (!user || !user.password) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { userId: user.id, role: user.role },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(200).json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                phone: user.phone,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role
            }
        });
    } catch (error) {
        handleControllerError(res, error, 'Login failed');
    }
};
