import request from 'supertest';
import app from '../src/app';
import prisma from '../src/prisma';

const testUser = {
    phone: '+9988776655',
    password: 'password123',
    firstName: 'Safety',
    lastName: 'Tester',
    email: 'safety@example.com'
};

async function runTests() {
    console.log('Starting Support & Safety Tests...');

    // Cleanup
    const users = await prisma.user.findMany({ where: { phone: testUser.phone } });
    const userIds = users.map(u => u.id);
    await prisma.supportTicket.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.emergencyContact.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });

    // 1. Register & Login
    console.log('1. Registering User...');
    await request(app).post('/api/auth/register').send(testUser);
    const loginRes = await request(app).post('/api/auth/login').send({ phone: testUser.phone, password: testUser.password });
    const token = loginRes.body.token;

    // 2. Create Support Ticket
    console.log('2. Creating Support Ticket...');
    const ticketRes = await request(app)
        .post('/api/support/tickets')
        .set('Authorization', `Bearer ${token}`)
        .send({
            subject: 'Issue with Ride',
            description: 'Driver was late',
            category: 'RIDE_ISSUE'
        });

    if (ticketRes.status !== 201) {
        console.error('Create ticket failed:', ticketRes.body);
        process.exit(1);
    }
    console.log('Ticket created:', ticketRes.body.ticket.id);

    // 3. Add Emergency Contact
    console.log('3. Adding Emergency Contact...');
    const contactRes = await request(app)
        .post('/api/safety/contacts')
        .set('Authorization', `Bearer ${token}`)
        .send({
            name: 'Mom',
            phone: '+1234567890'
        });

    if (contactRes.status !== 201) {
        console.error('Add contact failed:', contactRes.body);
        process.exit(1);
    }
    console.log('Contact added:', contactRes.body.contact.name);

    // 4. Trigger SOS
    console.log('4. Triggering SOS...');
    const sosRes = await request(app)
        .post('/api/safety/sos')
        .set('Authorization', `Bearer ${token}`)
        .send({
            lat: 48.8566,
            lng: 2.3522
        });

    if (sosRes.status !== 200) {
        console.error('SOS failed:', sosRes.body);
        process.exit(1);
    }
    console.log('SOS triggered:', sosRes.body);

    console.log('All Support & Safety Tests Passed!');
    await prisma.$disconnect();
}

runTests().catch(console.error);
