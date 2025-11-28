import request from 'supertest';
import app from '../src/app';
import prisma from '../src/prisma';
import http from 'http';
import { initSocket } from '../src/socket';

const server = http.createServer(app);
initSocket(server);

const clientUser = {
    phone: '+1112223333',
    password: 'password123',
    firstName: 'Pay',
    lastName: 'Client',
    email: 'pay_client@example.com'
};

const driverUser = {
    phone: '+4445556666',
    password: 'password123',
    firstName: 'Pay',
    lastName: 'Driver',
    email: 'pay_driver@example.com'
};

async function runTests() {
    console.log('Starting Payment Tests...');

    // Cleanup
    const users = await prisma.user.findMany({ where: { phone: { in: [clientUser.phone, driverUser.phone] } } });
    const userIds = users.map(u => u.id);
    await prisma.transaction.deleteMany({ where: { wallet: { userId: { in: userIds } } } });
    await prisma.wallet.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.ride.deleteMany({ where: { OR: [{ clientId: { in: userIds } }, { driverId: { in: userIds } }] } });
    await prisma.driverProfile.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });

    // 1. Register Users & Setup Wallets
    console.log('1. Registering Users & Setup...');
    // Client
    await request(app).post('/api/auth/register').send(clientUser);
    const clientLogin = await request(app).post('/api/auth/login').send({ phone: clientUser.phone, password: clientUser.password });
    const clientToken = clientLogin.body.token;
    // Fund Client Wallet
    await prisma.wallet.create({ data: { userId: clientLogin.body.user.id, balance: 2000 } });

    // Driver
    await request(app).post('/api/auth/register').send(driverUser);
    await prisma.user.update({ where: { phone: driverUser.phone }, data: { role: 'DRIVER' } });
    const driverLogin = await request(app).post('/api/auth/login').send({ phone: driverUser.phone, password: driverUser.password });
    const driverToken = driverLogin.body.token;
    // Fund Driver Wallet (for commission deductions)
    await prisma.wallet.create({ data: { userId: driverLogin.body.user.id, balance: 500 } });

    // 2. Test CASH Payment
    console.log('2. Testing CASH Payment...');
    // Request Ride
    const cashRideRes = await request(app)
        .post('/api/rides/request')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
            originLat: 48.8566, originLng: 2.3522,
            destLat: 48.8606, destLng: 2.3376,
            serviceType: 'TAXI',
            estimatedPrice: 1000,
            paymentMethod: 'CASH'
        });
    const cashRideId = cashRideRes.body.ride.id;

    // Driver Accepts & Completes
    await request(app).post(`/api/driver/rides/${cashRideId}/accept`).set('Authorization', `Bearer ${driverToken}`);
    await request(app).post(`/api/driver/rides/${cashRideId}/status`).set('Authorization', `Bearer ${driverToken}`).send({ status: 'COMPLETED' });

    // Check Driver Wallet (Should be 500 - 200 = 300)
    const driverWalletCash = await prisma.wallet.findUnique({ where: { userId: driverLogin.body.user.id } });
    if (driverWalletCash?.balance !== 300) {
        console.error('Cash payment failed. Expected 300, got:', driverWalletCash?.balance);
        process.exit(1);
    }
    console.log('Cash payment verified (Commission deducted)');

    // 3. Test WALLET Payment
    console.log('3. Testing WALLET Payment...');
    // Request Ride
    const walletRideRes = await request(app)
        .post('/api/rides/request')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
            originLat: 48.8566, originLng: 2.3522,
            destLat: 48.8606, destLng: 2.3376,
            serviceType: 'TAXI',
            estimatedPrice: 1000,
            paymentMethod: 'WALLET'
        });
    const walletRideId = walletRideRes.body.ride.id;

    // Driver Accepts & Completes
    await request(app).post(`/api/driver/rides/${walletRideId}/accept`).set('Authorization', `Bearer ${driverToken}`);
    await request(app).post(`/api/driver/rides/${walletRideId}/status`).set('Authorization', `Bearer ${driverToken}`).send({ status: 'COMPLETED' });

    // Check Client Wallet (Should be 2000 - 1000 = 1000)
    const clientWallet = await prisma.wallet.findUnique({ where: { userId: clientLogin.body.user.id } });
    if (clientWallet?.balance !== 1000) {
        console.error('Wallet payment failed (Client). Expected 1000, got:', clientWallet?.balance);
        process.exit(1);
    }

    // Check Driver Wallet (Should be 300 + 800 = 1100)
    const driverWalletWallet = await prisma.wallet.findUnique({ where: { userId: driverLogin.body.user.id } });
    if (driverWalletWallet?.balance !== 1100) {
        console.error('Wallet payment failed (Driver). Expected 1100, got:', driverWalletWallet?.balance);
        process.exit(1);
    }
    console.log('Wallet payment verified (Client deducted, Driver credited net)');

    // 4. Test DIGITAL Payment (Mobile Money)
    console.log('4. Testing DIGITAL Payment...');
    // Request Ride
    const digitalRideRes = await request(app)
        .post('/api/rides/request')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
            originLat: 48.8566, originLng: 2.3522,
            destLat: 48.8606, destLng: 2.3376,
            serviceType: 'TAXI',
            estimatedPrice: 1000,
            paymentMethod: 'MOBILE_MONEY'
        });
    const digitalRideId = digitalRideRes.body.ride.id;

    // Driver Accepts & Completes
    await request(app).post(`/api/driver/rides/${digitalRideId}/accept`).set('Authorization', `Bearer ${driverToken}`);
    await request(app).post(`/api/driver/rides/${digitalRideId}/status`).set('Authorization', `Bearer ${driverToken}`).send({ status: 'COMPLETED' });

    // Check Driver Wallet (Should be 1100 + 800 = 1900)
    const driverWalletDigital = await prisma.wallet.findUnique({ where: { userId: driverLogin.body.user.id } });
    if (driverWalletDigital?.balance !== 1900) {
        console.error('Digital payment failed. Expected 1900, got:', driverWalletDigital?.balance);
        process.exit(1);
    }
    console.log('Digital payment verified (Driver credited net)');

    console.log('All Payment Tests Passed!');
    await prisma.$disconnect();
}

runTests().catch(console.error);
