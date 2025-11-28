import request from 'supertest';
import app from '../src/app';
import prisma from '../src/prisma';
import http from 'http';
import { initSocket } from '../src/socket';

const server = http.createServer(app);
initSocket(server);

const testUser = {
    phone: '+1122334499',
    password: 'password123',
    firstName: 'Advanced',
    lastName: 'Rider',
    email: 'advanced@example.com'
};

async function runTests() {
    console.log('Starting Advanced Ride Tests...');

    // Cleanup
    const users = await prisma.user.findMany({ where: { phone: testUser.phone } });
    const userIds = users.map(u => u.id);
    await prisma.ride.deleteMany({ where: { clientId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });

    // 1. Register & Login
    console.log('1. Registering User...');
    await request(app).post('/api/auth/register').send(testUser);
    const loginRes = await request(app).post('/api/auth/login').send({ phone: testUser.phone, password: testUser.password });
    const token = loginRes.body.token;

    // 2. Book for Another
    console.log('2. Booking for Another Person...');
    const otherRes = await request(app)
        .post('/api/rides/request')
        .set('Authorization', `Bearer ${token}`)
        .send({
            originLat: 48.8566, originLng: 2.3522,
            destLat: 48.8606, destLng: 2.3376,
            serviceType: 'TAXI',
            estimatedPrice: 1000,
            passengerName: 'Friend',
            passengerPhone: '+9988776655'
        });

    if (otherRes.status !== 201 || otherRes.body.ride.passengerName !== 'Friend') {
        console.error('Book for another failed:', otherRes.body);
        process.exit(1);
    }
    console.log('Booked for another:', otherRes.body.ride.passengerName);

    // 3. Schedule Ride
    console.log('3. Scheduling a Ride...');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const scheduleRes = await request(app)
        .post('/api/rides/request')
        .set('Authorization', `Bearer ${token}`)
        .send({
            originLat: 48.8566, originLng: 2.3522,
            destLat: 48.8606, destLng: 2.3376,
            serviceType: 'VIP',
            estimatedPrice: 2000,
            scheduledTime: tomorrow.toISOString()
        });

    if (scheduleRes.status !== 201 || scheduleRes.body.ride.status !== 'SCHEDULED') {
        console.error('Schedule ride failed:', scheduleRes.body);
        process.exit(1);
    }
    console.log('Ride scheduled for:', scheduleRes.body.ride.scheduledTime);

    console.log('All Advanced Ride Tests Passed!');
    await prisma.$disconnect();
}

runTests().catch(console.error);
