import { Response } from 'express';
import prisma from '../prisma';
import { AuthRequest } from '../middleware/auth.middleware';
import { handleControllerError } from '../utils/errorHandler';

// Required documents for driver approval
const REQUIRED_DOCUMENTS = [
    'DRIVERS_LICENSE',
    'INSURANCE',
    'VEHICLE_REGISTRATION',
    'TECHNICAL_INSPECTION',
    'DRIVER_PHOTO'
];

// ============================================
// DRIVER ONBOARDING ENDPOINTS
// ============================================

/**
 * Register current user as a driver
 * Creates a DriverProfile with PENDING status
 */
export const registerAsDriver = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        // Check if already a driver
        const existingProfile = await prisma.driverProfile.findUnique({
            where: { userId }
        });

        if (existingProfile) {
            return res.status(400).json({
                error: 'Already registered as driver',
                onboardingStatus: existingProfile.onboardingStatus
            });
        }

        // Create driver profile
        const driverProfile = await prisma.driverProfile.create({
            data: {
                userId,
                onboardingStatus: 'PENDING',
                isApproved: false
            }
        });

        // Update user role
        await prisma.user.update({
            where: { id: userId },
            data: { role: 'DRIVER' }
        });

        res.status(201).json({
            message: 'Driver registration started',
            driverProfile,
            requiredDocuments: REQUIRED_DOCUMENTS,
            instructions: 'Please submit all required documents to complete your registration'
        });
    } catch (error) {
        handleControllerError(res, error, 'Failed to register as driver');
    }
};

/**
 * Submit a document for verification
 */
export const submitDocument = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { type, documentNumber, expiryDate, photoUrl } = req.body;

        // Validate required fields
        if (!type || !photoUrl) {
            return res.status(400).json({ error: 'Document type and photo URL are required' });
        }

        // Validate document type
        if (!REQUIRED_DOCUMENTS.includes(type)) {
            return res.status(400).json({
                error: 'Invalid document type',
                validTypes: REQUIRED_DOCUMENTS
            });
        }

        // Get driver profile
        const driver = await prisma.driverProfile.findUnique({
            where: { userId }
        });

        if (!driver) {
            return res.status(404).json({ error: 'Driver profile not found. Please register first.' });
        }

        // Upsert document (update if exists, create if not)
        const document = await prisma.driverDocument.upsert({
            where: {
                driverId_type: {
                    driverId: driver.id,
                    type: type
                }
            },
            update: {
                documentNumber,
                expiryDate: expiryDate ? new Date(expiryDate) : null,
                photoUrl,
                status: 'PENDING',
                rejectionReason: null,
                reviewedAt: null,
                reviewedBy: null
            },
            create: {
                driverId: driver.id,
                type,
                documentNumber,
                expiryDate: expiryDate ? new Date(expiryDate) : null,
                photoUrl,
                status: 'PENDING'
            }
        });

        // Check if all documents are submitted
        const submittedDocs = await prisma.driverDocument.findMany({
            where: { driverId: driver.id }
        });

        const allDocsSubmitted = REQUIRED_DOCUMENTS.every(
            docType => submittedDocs.some(doc => doc.type === docType)
        );

        // Update onboarding status if all docs submitted
        if (allDocsSubmitted && driver.onboardingStatus === 'PENDING') {
            await prisma.driverProfile.update({
                where: { id: driver.id },
                data: { onboardingStatus: 'DOCUMENTS_SUBMITTED' }
            });
        }

        res.status(201).json({
            message: 'Document submitted successfully',
            document,
            allDocumentsSubmitted: allDocsSubmitted,
            remainingDocuments: REQUIRED_DOCUMENTS.filter(
                docType => !submittedDocs.some(doc => doc.type === docType)
            )
        });
    } catch (error) {
        handleControllerError(res, error, 'Failed to submit document');
    }
};

/**
 * Get all documents for current driver
 */
export const getMyDocuments = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const driver = await prisma.driverProfile.findUnique({
            where: { userId },
            include: {
                documents: {
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        if (!driver) {
            return res.status(404).json({ error: 'Driver profile not found' });
        }

        const submittedTypes = driver.documents.map(doc => doc.type);
        const missingDocuments = REQUIRED_DOCUMENTS.filter(
            type => !submittedTypes.includes(type as any)
        );

        res.json({
            documents: driver.documents,
            missingDocuments,
            requiredDocuments: REQUIRED_DOCUMENTS
        });
    } catch (error) {
        handleControllerError(res, error, 'Failed to fetch documents');
    }
};

/**
 * Update a document
 */
export const updateDocument = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        const { id } = req.params;
        const { documentNumber, expiryDate, photoUrl } = req.body;

        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const driver = await prisma.driverProfile.findUnique({
            where: { userId }
        });

        if (!driver) {
            return res.status(404).json({ error: 'Driver profile not found' });
        }

        // Verify document belongs to this driver
        const existingDoc = await prisma.driverDocument.findFirst({
            where: { id, driverId: driver.id }
        });

        if (!existingDoc) {
            return res.status(404).json({ error: 'Document not found' });
        }

        const document = await prisma.driverDocument.update({
            where: { id },
            data: {
                ...(documentNumber && { documentNumber }),
                ...(expiryDate && { expiryDate: new Date(expiryDate) }),
                ...(photoUrl && { photoUrl }),
                status: 'PENDING', // Reset to pending after update
                rejectionReason: null,
                reviewedAt: null,
                reviewedBy: null
            }
        });

        res.json({
            message: 'Document updated successfully',
            document
        });
    } catch (error) {
        handleControllerError(res, error, 'Failed to update document');
    }
};

/**
 * Get onboarding status for current driver
 */
export const getOnboardingStatus = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const driver = await prisma.driverProfile.findUnique({
            where: { userId },
            include: {
                documents: true,
                vehicle: true
            }
        });

        if (!driver) {
            return res.status(404).json({ error: 'Driver profile not found' });
        }

        // Calculate document status summary
        const docsSummary = {
            total: REQUIRED_DOCUMENTS.length,
            submitted: driver.documents.length,
            approved: driver.documents.filter(d => d.status === 'APPROVED').length,
            rejected: driver.documents.filter(d => d.status === 'REJECTED').length,
            pending: driver.documents.filter(d => d.status === 'PENDING').length
        };

        // Get rejected documents with reasons
        const rejectedDocs = driver.documents
            .filter(d => d.status === 'REJECTED')
            .map(d => ({
                type: d.type,
                reason: d.rejectionReason
            }));

        res.json({
            onboardingStatus: driver.onboardingStatus,
            isApproved: driver.isApproved,
            canAcceptRides: driver.isApproved && driver.onboardingStatus === 'APPROVED',
            documents: docsSummary,
            rejectedDocuments: rejectedDocs,
            hasVehicle: !!driver.vehicle,
            nextSteps: getNextSteps(driver, docsSummary)
        });
    } catch (error) {
        handleControllerError(res, error, 'Failed to fetch onboarding status');
    }
};

// Helper function to determine next steps
function getNextSteps(driver: any, docsSummary: any): string[] {
    const steps: string[] = [];

    if (docsSummary.submitted < docsSummary.total) {
        steps.push(`Submit ${docsSummary.total - docsSummary.submitted} remaining document(s)`);
    }

    if (docsSummary.rejected > 0) {
        steps.push(`Resubmit ${docsSummary.rejected} rejected document(s)`);
    }

    if (docsSummary.pending > 0) {
        steps.push(`Wait for ${docsSummary.pending} document(s) to be reviewed`);
    }

    if (!driver.vehicle) {
        steps.push('Add vehicle information');
    }

    if (driver.onboardingStatus === 'APPROVED' && !driver.isApproved) {
        steps.push('Wait for final approval from admin');
    }

    if (steps.length === 0 && driver.isApproved) {
        steps.push('You are approved! You can now accept rides.');
    }

    return steps;
}

// ============================================
// ADMIN ENDPOINTS - DOCUMENT REVIEW
// ============================================

/**
 * Get all pending documents for review
 */
export const getPendingDocuments = async (req: AuthRequest, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const skip = (page - 1) * limit;

        const [documents, total] = await Promise.all([
            prisma.driverDocument.findMany({
                where: { status: 'PENDING' },
                skip,
                take: limit,
                orderBy: { createdAt: 'asc' },
                include: {
                    driver: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    firstName: true,
                                    lastName: true,
                                    phone: true,
                                    email: true
                                }
                            }
                        }
                    }
                }
            }),
            prisma.driverDocument.count({ where: { status: 'PENDING' } })
        ]);

        res.json({
            documents,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        handleControllerError(res, error, 'Failed to fetch pending documents');
    }
};

/**
 * Review a document (approve or reject)
 */
export const reviewDocument = async (req: AuthRequest, res: Response) => {
    try {
        const adminId = req.user?.userId;
        const { id } = req.params;
        const { action, rejectionReason } = req.body;

        if (!adminId) return res.status(401).json({ error: 'Unauthorized' });

        if (!['APPROVE', 'REJECT'].includes(action)) {
            return res.status(400).json({ error: 'Action must be APPROVE or REJECT' });
        }

        if (action === 'REJECT' && !rejectionReason) {
            return res.status(400).json({ error: 'Rejection reason is required' });
        }

        const document = await prisma.driverDocument.update({
            where: { id },
            data: {
                status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
                rejectionReason: action === 'REJECT' ? rejectionReason : null,
                reviewedAt: new Date(),
                reviewedBy: adminId
            },
            include: {
                driver: true
            }
        });

        // Check if all documents are now approved
        const allDocs = await prisma.driverDocument.findMany({
            where: { driverId: document.driverId }
        });

        const allApproved = REQUIRED_DOCUMENTS.every(
            docType => allDocs.some(doc => doc.type === docType && doc.status === 'APPROVED')
        );

        const hasRejected = allDocs.some(doc => doc.status === 'REJECTED');

        // Update driver status based on document statuses
        if (allApproved) {
            await prisma.driverProfile.update({
                where: { id: document.driverId },
                data: {
                    onboardingStatus: 'APPROVED',
                    isApproved: true,
                    approvedAt: new Date(),
                    approvedBy: adminId
                }
            });
        } else if (hasRejected) {
            await prisma.driverProfile.update({
                where: { id: document.driverId },
                data: {
                    onboardingStatus: 'REJECTED',
                    isApproved: false
                }
            });
        }

        res.json({
            message: `Document ${action.toLowerCase()}d successfully`,
            document,
            driverFullyApproved: allApproved
        });
    } catch (error) {
        handleControllerError(res, error, 'Failed to review document');
    }
};

/**
 * Get all documents for a specific driver (admin view)
 */
export const getDriverDocuments = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params; // Driver profile ID

        const driver = await prisma.driverProfile.findUnique({
            where: { id },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        phone: true,
                        email: true
                    }
                },
                documents: {
                    orderBy: { type: 'asc' }
                },
                vehicle: true
            }
        });

        if (!driver) {
            return res.status(404).json({ error: 'Driver not found' });
        }

        const submittedTypes = driver.documents.map(doc => doc.type);
        const missingDocuments = REQUIRED_DOCUMENTS.filter(
            type => !submittedTypes.includes(type as any)
        );

        res.json({
            driver: {
                id: driver.id,
                user: driver.user,
                onboardingStatus: driver.onboardingStatus,
                isApproved: driver.isApproved,
                approvedAt: driver.approvedAt
            },
            documents: driver.documents,
            missingDocuments,
            vehicle: driver.vehicle
        });
    } catch (error) {
        handleControllerError(res, error, 'Failed to fetch driver documents');
    }
};

// ============================================
// VEHICLE MANAGEMENT
// ============================================

/**
 * Add or update vehicle information
 */
export const addVehicle = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { make, model, year, color, plateNumber, type } = req.body;

        if (!make || !model || !year || !color || !plateNumber || !type) {
            return res.status(400).json({ error: 'All vehicle fields are required' });
        }

        const driver = await prisma.driverProfile.findUnique({
            where: { userId }
        });

        if (!driver) {
            return res.status(404).json({ error: 'Driver profile not found' });
        }

        const vehicle = await prisma.vehicle.upsert({
            where: { driverId: driver.id },
            update: { make, model, year, color, plateNumber, type },
            create: {
                driverId: driver.id,
                make,
                model,
                year,
                color,
                plateNumber,
                type
            }
        });

        res.json({
            message: 'Vehicle information saved',
            vehicle
        });
    } catch (error) {
        handleControllerError(res, error, 'Failed to save vehicle');
    }
};

/**
 * Get vehicle information
 */
export const getVehicle = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const driver = await prisma.driverProfile.findUnique({
            where: { userId },
            include: { vehicle: true }
        });

        if (!driver) {
            return res.status(404).json({ error: 'Driver profile not found' });
        }

        res.json({
            vehicle: driver.vehicle
        });
    } catch (error) {
        handleControllerError(res, error, 'Failed to fetch vehicle');
    }
};
