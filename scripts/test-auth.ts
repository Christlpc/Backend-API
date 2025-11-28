import request from 'supertest';
import app from '../src/app';
import prisma from '../src/prisma';

const testUser = {
    phone: '+1234567890',
    password: 'password123',
    firstName: 'Test',
    lastName: 'User',
    email: 'test@example.com'
};

async function runTests() {
    console.log('Starting Auth Tests...');

    // Cleanup
    await prisma.user.deleteMany({ where: { phone: testUser.phone } });

    // 1. Register
    console.log('1. Testing Registration...');
    const regRes = await request(app)
        .post('/api/auth/register')
        .send(testUser);

    if (regRes.status !== 201) {
        console.error('Registration failed:', regRes.body);
        process.exit(1);
    }
    console.log('Registration successful:', regRes.body);

    // 2. Login
    console.log('2. Testing Login...');
    const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
            phone: testUser.phone,
            password: testUser.password
        });

    if (loginRes.status !== 200) {
        console.error('Login failed:', loginRes.body);
        process.exit(1);
    }
    console.log('Login successful. Token received.');
    const token = loginRes.body.token;

    // 3. Protected Route
    console.log('3. Testing Protected Route...');
    const profileRes = await request(app)
        .get('/api/profile')
        .set('Authorization', `Bearer ${token}`);

    if (profileRes.status !== 200) {
        console.error('Protected route failed:', profileRes.body);
        process.exit(1);
    }
    console.log('Protected route accessed:', profileRes.body);

    console.log('All Auth Tests Passed!');
    await prisma.$disconnect();
}

runTests().catch(console.error);
