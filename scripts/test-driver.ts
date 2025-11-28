import request from 'supertest';
import app from '../src/app';
import prisma from '../src/prisma';

const driverUser = {
    phone: '+1122334455',
    password: 'password123',
    firstName: 'Driver',
    lastName: 'One',
    email: 'driver@example.com'
};

const clientUser = {
    phone: '+5544332211',
    password: 'password123',
    firstName: 'Client',
    lastName: 'Two',
    email: 'client@example.com'
};

async function runTests() {
    console.log('Starting Driver Tests...');

    // Cleanup
    await prisma.user.deleteMany({ where: { phone: { in: [driverUser.phone, clientUser.phone] } } });

    // 1. Register Driver & Client
    console.log('1. Registering Users...');
    // Driver
    const driverReg = await request(app).post('/api/auth/register').send(driverUser);
    const driverLogin = await request(app).post('/api/auth/login').send({ phone: driverUser.phone, password: driverUser.password });
    const driverToken = driverLogin.body.token;

    // Client
    const clientReg = await request(app).post('/api/auth/register').send(clientUser);
    const clientLogin = await request(app).post('/api/auth/login').send({ phone: clientUser.phone, password: clientUser.password });
    const clientToken = clientLogin.body.token;

    // 2. Driver Availability
    console.log('2. Testing Driver Availability...');
    const availRes = await request(app)
        .post('/api/driver/availability')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ isAvailable: true });

    if (availRes.status !== 200 || !availRes.body.isAvailable) {
        console.error('Availability failed:', availRes.body);
        process.exit(1);
    }
    console.log('Driver is online');

    // 3. Driver Location
    console.log('3. Testing Location Update...');
    const locRes = await request(app)
        .post('/api/driver/location')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ lat: 48.8566, lng: 2.3522 });

    if (locRes.status !== 200) {
        console.error('Location update failed:', locRes.body);
        process.exit(1);
    }
    console.log('Location updated');

    // 4. Client Requests Ride
    console.log('4. Client Requesting Ride...');
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
    console.log('Ride requested:', rideId);

    // 5. Driver Sees Available Rides
    console.log('5. Driver Fetching Available Rides...');
    const ridesRes = await request(app)
        .get('/api/driver/rides/available')
        .set('Authorization', `Bearer ${driverToken}`);

    const foundRide = ridesRes.body.rides.find((r: any) => r.id === rideId);
    if (!foundRide) {
        console.error('Ride not found in available list');
        process.exit(1);
    }
    console.log('Ride found in list');

    // 6. Driver Accepts Ride
    console.log('6. Driver Accepting Ride...');
    const acceptRes = await request(app)
        .post(`/api/driver/rides/${rideId}/accept`)
        .set('Authorization', `Bearer ${driverToken}`);

    if (acceptRes.status !== 200 || acceptRes.body.ride.status !== 'ACCEPTED') {
        console.error('Accept ride failed:', acceptRes.body);
        process.exit(1);
    }
    console.log('Ride accepted');

    // 7. Driver Completes Ride
    console.log('7. Driver Completing Ride...');
    const completeRes = await request(app)
        .post(`/api/driver/rides/${rideId}/status`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ status: 'COMPLETED' });

    if (completeRes.status !== 200 || completeRes.body.ride.status !== 'COMPLETED') {
        console.error('Complete ride failed:', completeRes.body);
        process.exit(1);
    }
    console.log('Ride completed');

    console.log('All Driver Tests Passed!');
    await prisma.$disconnect();
}

runTests().catch(console.error);
