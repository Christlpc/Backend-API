import request from 'supertest';
import app from '../src/app';
import prisma from '../src/prisma';
import http from 'http';
import { initSocket } from '../src/socket';

const server = http.createServer(app);
initSocket(server);

const testUser = {
    phone: '+1112223333',
    password: 'password123',
    firstName: 'Price',
    lastName: 'Tester',
    email: 'price_tester@example.com'
};

async function runTests() {
    console.log('Starting Pricing Tests...');

    // Cleanup
    const users = await prisma.user.findMany({ where: { phone: testUser.phone } });
    const userIds = users.map(u => u.id);
    await prisma.transaction.deleteMany({ where: { wallet: { userId: { in: userIds } } } });
    await prisma.wallet.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.ride.deleteMany({ where: { clientId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.pricingConfig.deleteMany({});

    // 1. Register User
    console.log('1. Registering User...');
    await request(app).post('/api/auth/register').send(testUser);
    const loginRes = await request(app).post('/api/auth/login').send({ phone: testUser.phone, password: testUser.password });
    const token = loginRes.body.token;

    // 2. Test Taxi Pricing (Standard)
    console.log('2. Testing Taxi Pricing...');
    // Distance ~1.5km
    const taxiRes = await request(app)
        .post('/api/rides/estimate')
        .set('Authorization', `Bearer ${token}`)
        .send({
            originLat: 48.8566, originLng: 2.3522,
            destLat: 48.8650, destLng: 2.3650,
            serviceType: 'TAXI'
        });

    // Formula: Base(1000) + (1.37km * 500) + (2.74min * 50) 
    // ~ 1000 + 685 + 137 = 1822 -> Round to 1900
    console.log('Taxi Estimate:', taxiRes.body);
    if (taxiRes.body.estimatedPrice < 1500) {
        console.error('Taxi price too low');
        process.exit(1);
    }

    // 3. Test Moto Pricing (Lower Base)
    console.log('3. Testing Moto Pricing...');
    const motoRes = await request(app)
        .post('/api/rides/estimate')
        .set('Authorization', `Bearer ${token}`)
        .send({
            originLat: 48.8566, originLng: 2.3522,
            destLat: 48.8650, destLng: 2.3650,
            serviceType: 'MOTO'
        });

    // Formula: Base(500) + (1.37km * 300) + (2.05min * 30)
    // ~ 500 + 411 + 61 = 972 -> Round to 1000
    console.log('Moto Estimate:', motoRes.body);
    if (motoRes.body.estimatedPrice >= taxiRes.body.estimatedPrice) {
        console.error('Moto price should be lower than Taxi');
        process.exit(1);
    }

    // 4. Test VIP Pricing (Higher Base + Multiplier)
    console.log('4. Testing VIP Pricing (Business)...');
    const vipRes = await request(app)
        .post('/api/rides/estimate')
        .set('Authorization', `Bearer ${token}`)
        .send({
            originLat: 48.8566, originLng: 2.3522,
            destLat: 48.8650, destLng: 2.3650,
            serviceType: 'VIP',
            vipTier: 'Business'
        });

    // Formula: (Base(2500) + (1.37 * 1000) + (2.74 * 100)) * 1.6
    // ~ (2500 + 1370 + 274) * 1.6 = 4144 * 1.6 = 6630 -> Round to 6700
    console.log('VIP Business Estimate:', vipRes.body);
    if (vipRes.body.estimatedPrice <= taxiRes.body.estimatedPrice * 2) {
        console.error('VIP Business price should be significantly higher');
        process.exit(1);
    }

    // 5. Test VIP Luxury (Higher Multiplier)
    console.log('5. Testing VIP Pricing (Luxury)...');
    const luxuryRes = await request(app)
        .post('/api/rides/estimate')
        .set('Authorization', `Bearer ${token}`)
        .send({
            originLat: 48.8566, originLng: 2.3522,
            destLat: 48.8650, destLng: 2.3650,
            serviceType: 'VIP',
            vipTier: 'Luxury'
        });

    console.log('VIP Luxury Estimate:', luxuryRes.body);
    if (luxuryRes.body.estimatedPrice <= vipRes.body.estimatedPrice) {
        console.error('Luxury price should be higher than Business');
        process.exit(1);
    }

    console.log('All Pricing Tests Passed!');
    await prisma.$disconnect();
}

runTests().catch(console.error);
