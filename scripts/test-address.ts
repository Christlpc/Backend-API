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
    firstName: 'Address',
    lastName: 'Tester',
    email: 'address_tester@example.com'
};

async function runTests() {
    console.log('Starting Address Tests...');

    // Cleanup
    const users = await prisma.user.findMany({ where: { phone: testUser.phone } });
    const userIds = users.map(u => u.id);
    await prisma.savedAddress.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });

    // 1. Register User
    console.log('1. Registering User...');
    await request(app).post('/api/auth/register').send(testUser);
    const loginRes = await request(app).post('/api/auth/login').send({ phone: testUser.phone, password: testUser.password });
    const token = loginRes.body.token;

    // 2. Add Address (Home)
    console.log('2. Adding Home Address...');
    const addRes = await request(app)
        .post('/api/addresses')
        .set('Authorization', `Bearer ${token}`)
        .send({
            label: 'Home',
            addressText: '123 Main St, Brazzaville',
            latitude: -4.2634,
            longitude: 15.2429,
            landmark: 'Near Central Market',
            details: 'Blue gate'
        });

    if (addRes.status !== 201) {
        console.error('Failed to add address:', addRes.body);
        process.exit(1);
    }
    const addressId = addRes.body.address.id;
    console.log('Address added:', addRes.body.address);

    // 3. List Addresses
    console.log('3. Listing Addresses...');
    const listRes = await request(app)
        .get('/api/addresses')
        .set('Authorization', `Bearer ${token}`);

    if (listRes.body.addresses.length !== 1 || listRes.body.addresses[0].label !== 'Home') {
        console.error('List failed or incorrect:', listRes.body);
        process.exit(1);
    }
    console.log('Addresses listed successfully');

    // 4. Update Address
    console.log('4. Updating Address...');
    const updateRes = await request(app)
        .put(`/api/addresses/${addressId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
            label: 'Home Sweet Home',
            details: 'Blue gate, code 1234'
        });

    if (updateRes.body.address.label !== 'Home Sweet Home') {
        console.error('Update failed:', updateRes.body);
        process.exit(1);
    }
    console.log('Address updated:', updateRes.body.address);

    // 5. Delete Address
    console.log('5. Deleting Address...');
    const deleteRes = await request(app)
        .delete(`/api/addresses/${addressId}`)
        .set('Authorization', `Bearer ${token}`);

    if (deleteRes.status !== 200) {
        console.error('Delete failed:', deleteRes.body);
        process.exit(1);
    }

    // Verify deletion
    const verifyList = await request(app)
        .get('/api/addresses')
        .set('Authorization', `Bearer ${token}`);

    if (verifyList.body.addresses.length !== 0) {
        console.error('Address not deleted');
        process.exit(1);
    }
    console.log('Address deleted successfully');

    console.log('All Address Tests Passed!');
    await prisma.$disconnect();
}

runTests().catch(console.error);
