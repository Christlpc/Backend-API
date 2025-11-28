import request from 'supertest';
import app from '../src/app';
import prisma from '../src/prisma';
import http from 'http';
import { initSocket } from '../src/socket';

const server = http.createServer(app);
initSocket(server);

const testUser = {
    phone: '+999888777',
    password: 'password123',
    firstName: 'Date',
    lastName: 'Tester',
    email: 'date_tester@example.com'
};

async function runTests() {
    console.log('Starting Date Handling Tests...');

    // Cleanup
    const users = await prisma.user.findMany({ where: { phone: testUser.phone } });
    const userIds = users.map(u => u.id);
    await prisma.ride.deleteMany({ where: { clientId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });

    // 1. Register User
    await request(app).post('/api/auth/register').send(testUser);
    const loginRes = await request(app).post('/api/auth/login').send({ phone: testUser.phone, password: testUser.password });
    const token = loginRes.body.token;

    // 2. Request Ride with Valid Date
    console.log('2. Requesting Ride with Valid Date...');
    const validDateRes = await request(app)
        .post('/api/rides/request')
        .set('Authorization', `Bearer ${token}`)
        .send({
            originLat: -4.2, originLng: 15.2,
            destLat: -4.3, destLng: 15.3,
            serviceType: 'TAXI',
            estimatedPrice: 1000,
            paymentMethod: 'CASH',
            scheduledTime: '2025-12-25T10:00:00Z'
        });

    console.log('Valid Date Response:', validDateRes.body.ride?.scheduledTime);

    // 3. Request Ride with NULL Date
    console.log('3. Requesting Ride with NULL Date...');
    const nullDateRes = await request(app)
        .post('/api/rides/request')
        .set('Authorization', `Bearer ${token}`)
        .send({
            originLat: -4.2, originLng: 15.2,
            destLat: -4.3, destLng: 15.3,
            serviceType: 'TAXI',
            estimatedPrice: 1000,
            paymentMethod: 'CASH',
            scheduledTime: null
        });

    console.log('Null Date Response:', nullDateRes.body.ride?.scheduledTime);

    // 4. Request Ride with Invalid Date String
    console.log('4. Requesting Ride with Invalid Date String...');
    const invalidDateRes = await request(app)
        .post('/api/rides/request')
        .set('Authorization', `Bearer ${token}`)
        .send({
            originLat: -4.2, originLng: 15.2,
            destLat: -4.3, destLng: 15.3,
            serviceType: 'TAXI',
            estimatedPrice: 1000,
            paymentMethod: 'CASH',
            scheduledTime: 'invalid-date-string'
        });

    console.log('Invalid Date Response Status:', invalidDateRes.status);
    console.log('Invalid Date Response Body:', invalidDateRes.body);

    await prisma.$disconnect();
}

runTests().catch(console.error);
