import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
    try {
        // We need to bypass the auth middleware to simulate a bad userId injection
        // OR we can just mock the request if we were running unit tests.
        // But since we are running against the live server, we need a valid token BUT
        // the error reported by the user shows `userId: 24` which implies the token was valid
        // but maybe the user was deleted? OR the code is manually setting userId?

        // Wait, the controller code says: `const userId = req.user?.userId;`
        // So the userId COMES from the token.
        // If the token is valid, the user SHOULD exist, unless they were deleted AFTER token issuance.

        // Let's simulate this:
        // 1. Create user
        // 2. Login (get token)
        // 3. Delete user (from DB directly)
        // 4. Try to create address with the token

        const phone = `+24206${Math.floor(Math.random() * 10000000)}`;
        const password = 'password123';

        // 1. Register
        const regRes = await fetch('http://localhost:3000/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, password, firstName: 'Test', lastName: 'User' })
        });
        const regData = await regRes.json();
        const userId = regData.userId;
        console.log('User created:', userId);

        // 2. Login
        const loginRes = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, password })
        });
        const loginData = await loginRes.json();
        const token = loginData.token;

        // 3. Delete user
        await prisma.user.delete({ where: { id: userId } });
        console.log('User deleted');

        // 4. Create Address
        const res = await fetch('http://localhost:3000/api/addresses', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                label: "Test Address",
                addressText: "Rue Test",
                latitude: 4.2,
                longitude: 15.2,
                landmark: "Test Landmark"
            })
        });

        console.log('Status:', res.status);
        const text = await res.text();
        console.log('Body:', text);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

run();
