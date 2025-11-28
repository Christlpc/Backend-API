import { io as Client } from 'socket.io-client';
import request from 'supertest';
import app from '../src/app';
import prisma from '../src/prisma';
import http from 'http';
import { initSocket } from '../src/socket';

// Setup test server with socket
const server = http.createServer(app);
initSocket(server);
const PORT = 3001; // Use different port for testing

const driverUser = {
    phone: '+1112223333',
    password: 'password123',
    firstName: 'Socket',
    lastName: 'Driver',
    email: 'socket_driver@example.com'
};

const clientUser = {
    phone: '+4445556666',
    password: 'password123',
    firstName: 'Socket',
    lastName: 'Client',
    email: 'socket_client@example.com'
};

async function runTests() {
    console.log('Starting Socket Tests...');

    // Start server
    await new Promise<void>(resolve => server.listen(PORT, resolve));

    // Cleanup
    const users = await prisma.user.findMany({ where: { phone: { in: [driverUser.phone, clientUser.phone] } } });
    const userIds = users.map(u => u.id);
    await prisma.ride.deleteMany({ where: { OR: [{ clientId: { in: userIds } }, { driverId: { in: userIds } }] } });
    await prisma.driverProfile.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });

    // 1. Register & Login
    console.log('1. Registering Users...');
    const driverReg = await request(app).post('/api/auth/register').send(driverUser);
    // Update role to DRIVER
    await prisma.user.update({
        where: { phone: driverUser.phone },
        data: { role: 'DRIVER' }
    });

    const driverLogin = await request(app).post('/api/auth/login').send({ phone: driverUser.phone, password: driverUser.password });
    const driverToken = driverLogin.body.token;

    const clientReg = await request(app).post('/api/auth/register').send(clientUser);
    const clientLogin = await request(app).post('/api/auth/login').send({ phone: clientUser.phone, password: clientUser.password });
    const clientToken = clientLogin.body.token;

    // 2. Connect Sockets
    console.log('2. Connecting Sockets...');
    const driverSocket = Client(`http://localhost:${PORT}`, {
        auth: { token: driverToken }
    });

    const clientSocket = Client(`http://localhost:${PORT}`, {
        auth: { token: clientToken }
    });

    await new Promise<void>(resolve => {
        let connected = 0;
        const check = () => { connected++; if (connected === 2) resolve(); };
        driverSocket.on('connect', check);
        clientSocket.on('connect', check);
    });
    console.log('Sockets connected');

    // 3. Test New Ride Notification
    console.log('3. Testing New Ride Notification...');
    const ridePromise = new Promise<void>((resolve, reject) => {
        driverSocket.on('new_ride_request', (ride) => {
            console.log('Driver received new ride request:', ride.id);
            resolve();
        });
        setTimeout(() => reject('Timeout waiting for new_ride_request'), 5000);
    });

    const rideRes = await request(app)
        .post('/api/rides/request')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
            originLat: 48.8566, originLng: 2.3522,
            destLat: 48.8606, destLng: 2.3376,
            serviceType: 'TAXI',
            estimatedPrice: 1000
        });
    const rideId = rideRes.body.ride.id;

    await ridePromise;

    // 4. Test Ride Status Update
    console.log('4. Testing Ride Status Update...');
    const statusPromise = new Promise<void>((resolve, reject) => {
        clientSocket.on('ride_status_update', (data) => {
            console.log('Client received status update:', data.status);
            if (data.status === 'ACCEPTED') resolve();
        });
        setTimeout(() => reject('Timeout waiting for ride_status_update'), 5000);
    });

    // Driver accepts ride
    await request(app)
        .post(`/api/driver/rides/${rideId}/accept`)
        .set('Authorization', `Bearer ${driverToken}`);

    await statusPromise;

    console.log('All Socket Tests Passed!');

    driverSocket.close();
    clientSocket.close();
    server.close();
    await prisma.$disconnect();
}

runTests().catch((err) => {
    console.error(err);
    process.exit(1);
});
