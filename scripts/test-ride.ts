import request from 'supertest';
import app from '../src/app';
import prisma from '../src/prisma';

const testUser = {
    phone: '+9876543210',
    password: 'password123',
    firstName: 'Ride',
    lastName: 'Tester',
    email: 'rider@example.com'
};

async function runTests() {
    console.log('Starting Ride Tests...');

    // Cleanup
    await prisma.user.deleteMany({ where: { phone: testUser.phone } });

    // 1. Register & Login
    console.log('1. Registering & Logging in...');
    await request(app).post('/api/auth/register').send(testUser);
    const loginRes = await request(app).post('/api/auth/login').send({
        phone: testUser.phone,
        password: testUser.password
    });
    const token = loginRes.body.token;

    // 2. Estimate Ride
    console.log('2. Testing Ride Estimation...');
    const estimateRes = await request(app)
        .post('/api/rides/estimate')
        .send({
            originLat: 48.8566, originLng: 2.3522, // Paris
            destLat: 48.8606, destLng: 2.3376  // Louvre
        });

    if (estimateRes.status !== 200) {
        console.error('Estimation failed:', estimateRes.body);
        process.exit(1);
    }
    console.log('Estimates received:', estimateRes.body.estimates);

    // 3. Request Ride
    console.log('3. Testing Ride Request...');
    const rideReq = {
        originLat: 48.8566, originLng: 2.3522,
        originAddress: "Paris",
        destLat: 48.8606, destLng: 2.3376,
        destAddress: "Louvre",
        serviceType: "TAXI",
        estimatedPrice: estimateRes.body.estimates[0].price
    };

    const requestRes = await request(app)
        .post('/api/rides/request')
        .set('Authorization', `Bearer ${token}`)
        .send(rideReq);

    if (requestRes.status !== 201) {
        console.error('Ride request failed:', requestRes.body);
        process.exit(1);
    }
    console.log('Ride requested successfully:', requestRes.body);

    console.log('All Ride Tests Passed!');
    await prisma.$disconnect();
}

runTests().catch(console.error);
