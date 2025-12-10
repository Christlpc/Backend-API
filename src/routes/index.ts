import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import * as rideController from '../controllers/ride.controller';
import * as driverController from '../controllers/driver.controller';
import * as supportController from '../controllers/support.controller';
import * as safetyController from '../controllers/safety.controller';
import * as walletController from '../controllers/wallet.controller';
import * as addressController from '../controllers/address.controller';
import * as statsController from '../controllers/stats.controller';
import * as backofficeController from '../controllers/backoffice.controller';
import * as driverOnboardingController from '../controllers/driver-onboarding.controller';
import * as ratingController from '../controllers/rating.controller';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { isAdmin } from '../middleware/admin.middleware';

const router = Router();

// Auth Routes
router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);

// Protected Route Example
router.get('/profile', authenticate, (req: AuthRequest, res) => {
    res.json({ message: 'This is a protected route', user: req.user });
});

// Ride Routes
router.post('/rides/estimate', rideController.estimateRide);
router.post('/rides/request', authenticate, rideController.requestRide);

// Rating Routes
router.post('/rides/:id/rate-driver', authenticate, ratingController.rateDriver);
router.post('/rides/:id/rate-client', authenticate, ratingController.rateClient);
router.get('/rides/:id/ratings', authenticate, ratingController.getRideRatings);
router.get('/ratings/my', authenticate, ratingController.getMyRatings);

// Driver Routes
router.post('/driver/availability', authenticate, driverController.toggleAvailability);
router.post('/driver/location', authenticate, driverController.updateLocation);
router.get('/driver/rides/available', authenticate, driverController.getAvailableRides);
router.post('/driver/rides/:id/accept', authenticate, driverController.acceptRide);
router.post('/driver/rides/:id/status', authenticate, driverController.updateRideStatus);

// Driver Onboarding Routes
router.post('/driver/register', authenticate, driverOnboardingController.registerAsDriver);
router.post('/driver/documents', authenticate, driverOnboardingController.submitDocument);
router.get('/driver/documents', authenticate, driverOnboardingController.getMyDocuments);
router.put('/driver/documents/:id', authenticate, driverOnboardingController.updateDocument);
router.get('/driver/onboarding-status', authenticate, driverOnboardingController.getOnboardingStatus);
router.post('/driver/vehicle', authenticate, driverOnboardingController.addVehicle);
router.get('/driver/vehicle', authenticate, driverOnboardingController.getVehicle);

// Support Routes
router.post('/support/tickets', authenticate, supportController.createTicket);
router.get('/support/tickets', authenticate, supportController.getTickets);

// Safety Routes
router.post('/safety/contacts', authenticate, safetyController.addEmergencyContact);
router.get('/safety/contacts', authenticate, safetyController.getEmergencyContacts);
router.post('/safety/sos', authenticate, safetyController.triggerSOS);

// Wallet Routes
router.get('/wallet', authenticate, walletController.getBalance);
router.post('/wallet/deposit', authenticate, walletController.deposit);
router.post('/wallet/withdraw', authenticate, walletController.withdraw);
router.get('/wallet/transactions', authenticate, walletController.getTransactions);

// Address Routes
router.post('/addresses', authenticate, addressController.addAddress);
router.get('/addresses', authenticate, addressController.getAddresses);
router.put('/addresses/:id', authenticate, addressController.updateAddress);
router.delete('/addresses/:id', authenticate, addressController.deleteAddress);

// Statistics Routes
router.get('/stats/driver', authenticate, statsController.getDriverStats);
router.get('/stats/client', authenticate, statsController.getClientStats);

// ============================================
// BACKOFFICE ROUTES (Admin Only)
// ============================================

// User Management
router.get('/backoffice/users', authenticate, isAdmin, backofficeController.getAllUsers);
router.get('/backoffice/users/:id', authenticate, isAdmin, backofficeController.getUserById);
router.put('/backoffice/users/:id', authenticate, isAdmin, backofficeController.updateUser);
router.patch('/backoffice/users/:id/status', authenticate, isAdmin, backofficeController.toggleUserStatus);
router.patch('/backoffice/users/:id/role', authenticate, isAdmin, backofficeController.changeUserRole);
router.delete('/backoffice/users/:id', authenticate, isAdmin, backofficeController.deleteUser);

// Driver Management
router.get('/backoffice/drivers', authenticate, isAdmin, backofficeController.getAllDrivers);
router.get('/backoffice/drivers/:id', authenticate, isAdmin, backofficeController.getDriverDetails);
router.patch('/backoffice/drivers/:id/approve', authenticate, isAdmin, backofficeController.approveDriver);
router.patch('/backoffice/drivers/:id/suspend', authenticate, isAdmin, backofficeController.suspendDriver);

// Document Review (Admin)
router.get('/backoffice/documents/pending', authenticate, isAdmin, driverOnboardingController.getPendingDocuments);
router.patch('/backoffice/documents/:id/review', authenticate, isAdmin, driverOnboardingController.reviewDocument);
router.get('/backoffice/drivers/:id/documents', authenticate, isAdmin, driverOnboardingController.getDriverDocuments);

// Rating Management (Admin)
router.get('/backoffice/ratings/red-zone', authenticate, isAdmin, ratingController.getRedZoneUsers);
router.get('/backoffice/users/:id/reputation', authenticate, isAdmin, ratingController.getUserReputationStatus);
router.patch('/backoffice/users/:id/reputation/reset', authenticate, isAdmin, ratingController.resetUserReputation);
router.get('/backoffice/ratings/config', authenticate, isAdmin, ratingController.getRatingConfig);
router.put('/backoffice/ratings/config', authenticate, isAdmin, ratingController.updateRatingConfig);

// Platform Statistics
router.get('/backoffice/stats', authenticate, isAdmin, backofficeController.getPlatformStats);
router.get('/backoffice/stats/revenue', authenticate, isAdmin, backofficeController.getRevenueStats);
router.get('/backoffice/stats/drivers-map', authenticate, isAdmin, backofficeController.getActiveDriversMap);

// Ride Management
router.get('/backoffice/rides', authenticate, isAdmin, backofficeController.getAllRides);
router.get('/backoffice/rides/:id', authenticate, isAdmin, backofficeController.getRideDetails);
router.patch('/backoffice/rides/:id/cancel', authenticate, isAdmin, backofficeController.cancelRide);

// Transaction Management
router.get('/backoffice/transactions', authenticate, isAdmin, backofficeController.getAllTransactions);
router.get('/backoffice/transactions/:id', authenticate, isAdmin, backofficeController.getTransactionDetails);

export default router;
