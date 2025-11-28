import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import * as rideController from '../controllers/ride.controller';
import * as driverController from '../controllers/driver.controller';
import * as supportController from '../controllers/support.controller';
import * as safetyController from '../controllers/safety.controller';
import * as walletController from '../controllers/wallet.controller';
import * as addressController from '../controllers/address.controller';
import * as statsController from '../controllers/stats.controller';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';

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

// Driver Routes
router.post('/driver/availability', authenticate, driverController.toggleAvailability);
router.post('/driver/location', authenticate, driverController.updateLocation);
router.get('/driver/rides/available', authenticate, driverController.getAvailableRides);
router.post('/driver/rides/:id/accept', authenticate, driverController.acceptRide);
router.post('/driver/rides/:id/status', authenticate, driverController.updateRideStatus);

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

export default router;
