import request from 'supertest';
import app from '../src/app';
import prisma from '../src/prisma';
import http from 'http';
import { initSocket } from '../src/socket';

const server = http.createServer(app);
initSocket(server);

const clientUser = {
    phone: '+242060000001',
    password: 'password123',
    firstName: 'Stats',
    lastName: 'Client',
    email: 'stats_client@example.com'
};

const driverUser = {
    phone: '+242060000002',
    password: 'password123',
    firstName: 'Stats',
    lastName: 'Driver',
    email: 'stats_driver@example.com'
};

async function runTests() {
    console.log('Starting Statistics Tests...');

    // Cleanup
    await prisma.ride.deleteMany({ where: { client: { phone: clientUser.phone } } });
    await prisma.driverProfile.deleteMany({ where: { user: { phone: driverUser.phone } } });
    await prisma.user.deleteMany({ where: { phone: { in: [clientUser.phone, driverUser.phone] } } });

    // 1. Register Client & Driver
    const clientReg = await request(app).post('/api/auth/register').send(clientUser);
    const clientToken = (await request(app).post('/api/auth/login').send({ phone: clientUser.phone, password: clientUser.password })).body.token;
    const clientId = clientReg.body.userId;

    const driverReg = await request(app).post('/api/auth/register').send(driverUser);
    const driverToken = (await request(app).post('/api/auth/login').send({ phone: driverUser.phone, password: driverUser.password })).body.token;
    const driverId = driverReg.body.userId;

    // Create Driver Profile
    await prisma.driverProfile.create({ data: { userId: driverId, isAvailable: true } });
    const driverProfile = await prisma.driverProfile.findUnique({ where: { userId: driverId } });

    // 2. Create Completed Rides (Mocking Data)
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    // Ride 1: Today, 1 hour duration, 5000 XAF
    await prisma.ride.create({
        data: {
            clientId,
            driverId: driverProfile!.id,
            originLat: 0, originLng: 0, originAddress: 'A',
            destLat: 0, destLng: 0, destAddress: 'B',
            serviceType: 'TAXI',
            status: 'COMPLETED',
            estimatedPrice: 5000,
            finalPrice: 5000,
            startedAt: twoHoursAgo,
            completedAt: oneHourAgo,
            createdAt: now,
            updatedAt: now
        }
    });

    // Ride 2: Today, 30 min duration, 3000 XAF
    await prisma.ride.create({
        data: {
            clientId,
            driverId: driverProfile!.id,
            originLat: 0, originLng: 0, originAddress: 'C',
            destLat: 0, destLng: 0, destAddress: 'D',
            serviceType: 'TAXI',
            status: 'COMPLETED',
            estimatedPrice: 3000,
            finalPrice: 3000,
            startedAt: new Date(now.getTime() - 30 * 60 * 1000),
            completedAt: now,
            createdAt: now,
            updatedAt: now
        }
    });

    // 3. Test Driver Stats (Day)
    console.log('Testing Driver Stats (Day)...');
    const driverStats = await request(app)
        .get('/api/stats/driver?timeframe=day')
        .set('Authorization', `Bearer ${driverToken}`);

    console.log('Driver Stats:', driverStats.body);

    if (driverStats.body.totalRides !== 2 || driverStats.body.totalRevenue !== 8000) {
        console.error('Driver stats mismatch');
        process.exit(1);
    }

    // 4. Test Client Stats (Day)
    console.log('Testing Client Stats (Day)...');
    const clientStats = await request(app)
        .get('/api/stats/client?timeframe=day')
        .set('Authorization', `Bearer ${clientToken}`);

    console.log('Client Stats:', clientStats.body);

    if (clientStats.body.totalRides !== 2 || clientStats.body.totalSpent !== 8000) {
        console.error('Client stats mismatch');
        process.exit(1);
    }

    console.log('All Statistics Tests Passed!');
    await prisma.$disconnect();
}

runTests().catch(console.error);
