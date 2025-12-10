import { Response } from 'express';
import { Prisma } from '@prisma/client';

export const handleControllerError = (res: Response, error: any, defaultMessage: string = 'Internal server error') => {
    console.error('Controller Error:', error);

    if (error instanceof Prisma.PrismaClientValidationError) {
        return res.status(400).json({
            error: 'Validation Error',
            details: error.message.split('\n').pop()?.trim() || 'Invalid input data'
        });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // P2003: Foreign key constraint failed
        if (error.code === 'P2003') {
            return res.status(400).json({
                error: 'Constraint Violation',
                details: 'Referenced record not found (e.g., invalid ID)'
            });
        }
        // P2002: Unique constraint failed
        if (error.code === 'P2002') {
            const target = (error.meta?.target as string[]) || 'field';
            return res.status(409).json({
                error: 'Conflict',
                details: `Unique constraint failed on: ${target}`
            });
        }
        // P2025: Record not found (when using update/delete on non-existent ID)
        if (error.code === 'P2025') {
            return res.status(404).json({
                error: 'Not Found',
                details: 'Record not found'
            });
        }
    }

    res.status(500).json({ error: defaultMessage });
};
