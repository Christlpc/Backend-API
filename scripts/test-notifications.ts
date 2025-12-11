import request from 'supertest';
import app from '../src/app';
import prisma from '../src/prisma';

// Test users
const adminUser = {
    phone: '+8880001111',
    password: 'password123',
    firstName: 'Notif',
    lastName: 'Admin',
    email: 'notif_admin@test.com'
};

const clientUser = {
    phone: '+8880002222',
    password: 'password123',
    firstName: 'Notif',
    lastName: 'Client',
    email: 'notif_client@test.com'
};

async function runTests() {
    console.log('🚀 Starting Notification System Tests...\n');

    // Cleanup
    console.log('🧹 Cleaning up test data...');
    const testPhones = [adminUser.phone, clientUser.phone];
    const users = await prisma.user.findMany({ where: { phone: { in: testPhones } } });
    const userIds = users.map(u => u.id);

    await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });

    // 1. Register users
    console.log('\n📝 1. Registering test users...');
    await request(app).post('/api/auth/register').send(adminUser);
    await request(app).post('/api/auth/register').send(clientUser);

    // Make first user admin
    await prisma.user.update({ where: { phone: adminUser.phone }, data: { role: 'ADMIN' } });

    // Login
    const adminLogin = await request(app).post('/api/auth/login').send({ phone: adminUser.phone, password: adminUser.password });
    const clientLogin = await request(app).post('/api/auth/login').send({ phone: clientUser.phone, password: clientUser.password });

    const adminToken = adminLogin.body.token;
    const clientToken = clientLogin.body.token;

    console.log('✅ Users registered and logged in');

    // ============================================
    // NOTIFICATION TESTS
    // ============================================
    console.log('\n========================================');
    console.log('🔔 NOTIFICATION SYSTEM TESTS');
    console.log('========================================\n');

    // 2. Register FCM token
    console.log('📝 2. Registering FCM token...');
    const registerTokenRes = await request(app)
        .post('/api/notifications/register-token')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ fcmToken: 'test-fcm-token-12345' });

    if (registerTokenRes.status !== 200) {
        console.error('❌ Failed to register token:', registerTokenRes.body);
        process.exit(1);
    }
    console.log('✅ FCM token registered');

    // 3. Get notifications (should be empty)
    console.log('\n📝 3. Getting notifications (should be empty)...');
    const getNotifRes = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${clientToken}`);

    if (getNotifRes.status !== 200) {
        console.error('❌ Failed to get notifications:', getNotifRes.body);
        process.exit(1);
    }
    console.log('✅ Notifications retrieved. Count:', getNotifRes.body.notifications.length);

    // 4. Admin sends notification to user
    console.log('\n📝 4. Admin sending notification to user...');
    const clientUser2 = await prisma.user.findUnique({ where: { phone: clientUser.phone } });

    const sendNotifRes = await request(app)
        .post('/api/backoffice/notifications/send')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
            userId: clientUser2!.id,
            title: 'Test Notification 🔔',
            body: 'Ceci est une notification de test',
            type: 'SYSTEM'
        });

    if (sendNotifRes.status !== 200) {
        console.error('❌ Failed to send notification:', sendNotifRes.body);
        process.exit(1);
    }
    console.log('✅ Notification sent by admin');

    // 5. Get notifications (should have 1)
    console.log('\n📝 5. Getting notifications (should have 1)...');
    const getNotifRes2 = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${clientToken}`);

    if (getNotifRes2.status !== 200 || getNotifRes2.body.notifications.length !== 1) {
        console.error('❌ Expected 1 notification:', getNotifRes2.body);
        process.exit(1);
    }
    const notifId = getNotifRes2.body.notifications[0].id;
    console.log('✅ 1 notification found:', getNotifRes2.body.notifications[0].title);

    // 6. Get unread count
    console.log('\n📝 6. Getting unread count...');
    const unreadRes = await request(app)
        .get('/api/notifications/unread-count')
        .set('Authorization', `Bearer ${clientToken}`);

    if (unreadRes.status !== 200 || unreadRes.body.unreadCount !== 1) {
        console.error('❌ Expected unread count 1:', unreadRes.body);
        process.exit(1);
    }
    console.log('✅ Unread count:', unreadRes.body.unreadCount);

    // 7. Mark as read
    console.log('\n📝 7. Marking notification as read...');
    const markReadRes = await request(app)
        .patch(`/api/notifications/${notifId}/read`)
        .set('Authorization', `Bearer ${clientToken}`);

    if (markReadRes.status !== 200) {
        console.error('❌ Failed to mark as read:', markReadRes.body);
        process.exit(1);
    }
    console.log('✅ Notification marked as read');

    // 8. Verify unread count is now 0
    console.log('\n📝 8. Verifying unread count is now 0...');
    const unreadRes2 = await request(app)
        .get('/api/notifications/unread-count')
        .set('Authorization', `Bearer ${clientToken}`);

    if (unreadRes2.body.unreadCount !== 0) {
        console.error('❌ Expected unread count 0:', unreadRes2.body);
        process.exit(1);
    }
    console.log('✅ Unread count is now 0');

    // 9. Test broadcast notification
    console.log('\n📝 9. Testing broadcast notification...');
    const broadcastRes = await request(app)
        .post('/api/backoffice/notifications/broadcast')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
            title: 'Broadcast Test 📢',
            body: 'Message pour tous les utilisateurs',
            type: 'SYSTEM'
        });

    if (broadcastRes.status !== 200) {
        console.error('❌ Failed to broadcast:', broadcastRes.body);
        process.exit(1);
    }
    console.log('✅ Broadcast sent to', broadcastRes.body.count, 'users');

    // 10. Unregister token
    console.log('\n📝 10. Unregistering FCM token...');
    const unregisterRes = await request(app)
        .delete('/api/notifications/unregister-token')
        .set('Authorization', `Bearer ${clientToken}`);

    if (unregisterRes.status !== 200) {
        console.error('❌ Failed to unregister token:', unregisterRes.body);
        process.exit(1);
    }
    console.log('✅ FCM token unregistered');

    // ============================================
    // SUMMARY
    // ============================================
    console.log('\n========================================');
    console.log('🎉 ALL TESTS PASSED!');
    console.log('========================================\n');

    console.log('Summary:');
    console.log('✅ FCM token registration');
    console.log('✅ FCM token unregistration');
    console.log('✅ Get notifications');
    console.log('✅ Unread count');
    console.log('✅ Admin send notification');
    console.log('✅ Mark as read');
    console.log('✅ Broadcast notification');

    await prisma.$disconnect();
}

runTests().catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
});
