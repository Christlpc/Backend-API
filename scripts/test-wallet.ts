import request from 'supertest';
import app from '../src/app';
import prisma from '../src/prisma';

const clientUser = {
    phone: '+1112223333',
    password: 'password123',
    firstName: 'Wallet',
    lastName: 'Client',
    email: 'wallet_client@example.com'
};

const driverUser = {
    phone: '+4445556666',
    password: 'password123',
    firstName: 'Wallet',
    lastName: 'Driver',
    email: 'wallet_driver@example.com'
};

async function runTests() {
    console.log('Starting Wallet Tests...');

    // Cleanup
    const users = await prisma.user.findMany({ where: { phone: { in: [clientUser.phone, driverUser.phone] } } });
    const userIds = users.map(u => u.id);
    await prisma.transaction.deleteMany({ where: { wallet: { userId: { in: userIds } } } });
    await prisma.wallet.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.ride.deleteMany({ where: { OR: [{ clientId: { in: userIds } }, { driverId: { in: userIds } }] } });
    await prisma.driverProfile.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });

    // 1. Register Users
    console.log('1. Registering Users...');
    // Client
    await request(app).post('/api/auth/register').send(clientUser);
    const clientLogin = await request(app).post('/api/auth/login').send({ phone: clientUser.phone, password: clientUser.password });
    const clientToken = clientLogin.body.token;

    // Driver
    await request(app).post('/api/auth/register').send(driverUser);
    // Set role to DRIVER
    await prisma.user.update({ where: { phone: driverUser.phone }, data: { role: 'DRIVER' } });
    const driverLogin = await request(app).post('/api/auth/login').send({ phone: driverUser.phone, password: driverUser.password });
    const driverToken = driverLogin.body.token;

    // 2. Client Deposit
    console.log('2. Client Deposit...');
    const depositRes = await request(app)
        .post('/api/wallet/deposit')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ amount: 1000 });

    if (depositRes.status !== 200 || depositRes.body.balance !== 1000) {
        console.error('Deposit failed:', depositRes.body);
        process.exit(1);
    }
    console.log('Deposit success, balance:', depositRes.body.balance);

    // 3. Driver Withdrawal (Fail - Insufficient Funds)
    console.log('3. Driver Withdrawal (Insufficient Funds)...');
    const withdrawFailRes = await request(app)
        .post('/api/wallet/withdraw')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ amount: 500 });

    if (withdrawFailRes.status !== 400) {
        console.error('Withdrawal should have failed:', withdrawFailRes.body);
        process.exit(1);
    }
    console.log('Withdrawal failed as expected (Insufficient funds)');

    // 4. Driver Deposit (Should Fail)
    console.log('4. Driver Deposit (Should Fail)...');
    const driverDepositRes = await request(app)
        .post('/api/wallet/deposit')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ amount: 500 });

    if (driverDepositRes.status !== 403) {
        console.error('Driver deposit should have failed:', driverDepositRes.body);
        process.exit(1);
    }
    console.log('Driver deposit failed as expected');

    // 5. Manually fund driver wallet for withdrawal test
    console.log('5. Funding Driver Wallet (Manual)...');
    const driver = await prisma.user.findUnique({ where: { phone: driverUser.phone } });
    const driverWallet = await prisma.wallet.update({
        where: { userId: driver!.id },
        data: { balance: 2000 }
    });
    console.log('Driver wallet funded:', driverWallet.balance);

    // 6. Driver Withdrawal (Success)
    console.log('6. Driver Withdrawal (Success)...');
    const withdrawRes = await request(app)
        .post('/api/wallet/withdraw')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ amount: 500 });

    if (withdrawRes.status !== 200 || withdrawRes.body.balance !== 1500) {
        console.error('Withdrawal failed:', withdrawRes.body);
        process.exit(1);
    }
    console.log('Withdrawal success, balance:', withdrawRes.body.balance);

    // 7. Get Transactions
    console.log('7. Get Transactions...');
    const txRes = await request(app)
        .get('/api/wallet/transactions')
        .set('Authorization', `Bearer ${driverToken}`);

    if (txRes.status !== 200 || txRes.body.transactions.length === 0) {
        console.error('Get transactions failed:', txRes.body);
        process.exit(1);
    }
    console.log('Transactions fetched:', txRes.body.transactions.length);

    console.log('All Wallet Tests Passed!');
    await prisma.$disconnect();
}

runTests().catch(console.error);
