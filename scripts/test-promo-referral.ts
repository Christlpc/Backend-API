import request from 'supertest';
import app from '../src/app';
import prisma from '../src/prisma';

// Test users
const adminUser = {
    phone: '+9990001111',
    password: 'password123',
    firstName: 'Promo',
    lastName: 'Admin',
    email: 'promo_admin@test.com'
};

const clientUser1 = {
    phone: '+9990002222',
    password: 'password123',
    firstName: 'Client',
    lastName: 'One',
    email: 'client1_promo@test.com'
};

const clientUser2 = {
    phone: '+9990003333',
    password: 'password123',
    firstName: 'Client',
    lastName: 'Two',
    email: 'client2_promo@test.com'
};

async function runTests() {
    console.log('🚀 Starting Promo Code & Referral System Tests...\n');

    // Cleanup
    console.log('🧹 Cleaning up test data...');
    const testPhones = [adminUser.phone, clientUser1.phone, clientUser2.phone];
    const users = await prisma.user.findMany({ where: { phone: { in: testPhones } } });
    const userIds = users.map(u => u.id);

    await prisma.promoCodeUsage.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.referral.deleteMany({ where: { OR: [{ referrerId: { in: userIds } }, { refereeId: { in: userIds } }] } });
    await prisma.transaction.deleteMany({ where: { wallet: { userId: { in: userIds } } } });
    await prisma.wallet.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    // Clean up test promo codes
    await prisma.promoCode.deleteMany({ where: { code: { startsWith: 'TEST' } } });

    // 1. Register users
    console.log('\n📝 1. Registering test users...');
    await request(app).post('/api/auth/register').send(adminUser);
    await request(app).post('/api/auth/register').send(clientUser1);
    await request(app).post('/api/auth/register').send(clientUser2);

    // Make first user admin
    await prisma.user.update({ where: { phone: adminUser.phone }, data: { role: 'ADMIN' } });

    // Login all users
    const adminLogin = await request(app).post('/api/auth/login').send({ phone: adminUser.phone, password: adminUser.password });
    const client1Login = await request(app).post('/api/auth/login').send({ phone: clientUser1.phone, password: clientUser1.password });
    const client2Login = await request(app).post('/api/auth/login').send({ phone: clientUser2.phone, password: clientUser2.password });

    const adminToken = adminLogin.body.token;
    const client1Token = client1Login.body.token;
    const client2Token = client2Login.body.token;

    console.log('✅ Users registered and logged in');

    // ============================================
    // PROMO CODE TESTS
    // ============================================
    console.log('\n========================================');
    console.log('🎟️  PROMO CODE TESTS');
    console.log('========================================\n');

    // 2. Create promo code (Admin)
    console.log('📝 2. Creating promo code (Admin)...');
    const createPromoRes = await request(app)
        .post('/api/backoffice/promo-codes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
            code: 'TESTAFRIGO2024',
            description: 'Test promo code 10% off',
            discountType: 'PERCENTAGE',
            discountValue: 10,
            maxUses: 100,
            maxUsesPerUser: 1,
            minRideAmount: 1000
        });

    if (createPromoRes.status !== 201) {
        console.error('❌ Failed to create promo code:', createPromoRes.body);
        process.exit(1);
    }
    const promoCodeId = createPromoRes.body.promoCode.id;
    console.log('✅ Promo code created:', createPromoRes.body.promoCode.code);

    // 3. List promo codes (Admin)
    console.log('\n📝 3. Listing promo codes (Admin)...');
    const listPromoRes = await request(app)
        .get('/api/backoffice/promo-codes')
        .set('Authorization', `Bearer ${adminToken}`);

    if (listPromoRes.status !== 200 || listPromoRes.body.promoCodes.length === 0) {
        console.error('❌ Failed to list promo codes:', listPromoRes.body);
        process.exit(1);
    }
    console.log('✅ Listed', listPromoRes.body.promoCodes.length, 'promo code(s)');

    // 4. Validate promo code (Client)
    console.log('\n📝 4. Validating promo code (Client)...');
    const validateRes = await request(app)
        .post('/api/promo/validate')
        .set('Authorization', `Bearer ${client1Token}`)
        .send({
            code: 'TESTAFRIGO2024',
            rideAmount: 5000,
            serviceType: 'TAXI'
        });

    if (validateRes.status !== 200 || !validateRes.body.valid) {
        console.error('❌ Failed to validate promo code:', validateRes.body);
        process.exit(1);
    }
    console.log('✅ Promo code valid! Estimated discount:', validateRes.body.estimatedDiscount, 'XAF');

    // 5. Apply promo code (Client)
    console.log('\n📝 5. Applying promo code (Client)...');
    const applyRes = await request(app)
        .post('/api/promo/apply')
        .set('Authorization', `Bearer ${client1Token}`)
        .send({
            code: 'TESTAFRIGO2024',
            rideAmount: 5000,
            serviceType: 'TAXI'
        });

    if (applyRes.status !== 200 || !applyRes.body.success) {
        console.error('❌ Failed to apply promo code:', applyRes.body);
        process.exit(1);
    }
    console.log('✅ Promo code applied! Discount:', applyRes.body.discount, 'XAF. Final:', applyRes.body.finalAmount, 'XAF');

    // 6. Try to reuse promo code (should fail)
    console.log('\n📝 6. Trying to reuse promo code (should fail)...');
    const reuseRes = await request(app)
        .post('/api/promo/apply')
        .set('Authorization', `Bearer ${client1Token}`)
        .send({
            code: 'TESTAFRIGO2024',
            rideAmount: 5000
        });

    if (reuseRes.status === 200) {
        console.error('❌ Promo code should not be reusable!');
        process.exit(1);
    }
    console.log('✅ Correctly rejected reuse:', reuseRes.body.error);

    // 7. Get promo code stats (Admin)
    console.log('\n📝 7. Getting promo code stats (Admin)...');
    const statsRes = await request(app)
        .get(`/api/backoffice/promo-codes/${promoCodeId}/stats`)
        .set('Authorization', `Bearer ${adminToken}`);

    if (statsRes.status !== 200) {
        console.error('❌ Failed to get promo stats:', statsRes.body);
        process.exit(1);
    }
    console.log('✅ Promo stats - Uses:', statsRes.body.totalUsages, '| Discount given:', statsRes.body.totalDiscountGiven, 'XAF');

    // ============================================
    // REFERRAL TESTS
    // ============================================
    console.log('\n========================================');
    console.log('👥 REFERRAL SYSTEM TESTS');
    console.log('========================================\n');

    // 8. Get referral code (Client 1)
    console.log('📝 8. Getting referral code (Client 1)...');
    const refCodeRes = await request(app)
        .get('/api/referral/my-code')
        .set('Authorization', `Bearer ${client1Token}`);

    if (refCodeRes.status !== 200 || !refCodeRes.body.referralCode) {
        console.error('❌ Failed to get referral code:', refCodeRes.body);
        process.exit(1);
    }
    const referralCode = refCodeRes.body.referralCode;
    console.log('✅ Referral code:', referralCode);
    console.log('   Share message:', refCodeRes.body.shareMessage);

    // 9. Apply referral code (Client 2)
    console.log('\n📝 9. Applying referral code (Client 2 as new user)...');
    const applyRefRes = await request(app)
        .post('/api/referral/apply')
        .set('Authorization', `Bearer ${client2Token}`)
        .send({
            code: referralCode
        });

    if (applyRefRes.status !== 200 || !applyRefRes.body.success) {
        console.error('❌ Failed to apply referral code:', applyRefRes.body);
        process.exit(1);
    }
    console.log('✅ Referral applied! Message:', applyRefRes.body.message);

    // 10. Get my referrals (Client 1)
    console.log('\n📝 10. Getting my referrals (Client 1)...');
    const myRefsRes = await request(app)
        .get('/api/referral/my-referrals')
        .set('Authorization', `Bearer ${client1Token}`);

    if (myRefsRes.status !== 200) {
        console.error('❌ Failed to get referrals:', myRefsRes.body);
        process.exit(1);
    }
    console.log('✅ Client 1 has', myRefsRes.body.referrals.length, 'referral(s)');
    if (myRefsRes.body.referrals.length > 0) {
        console.log('   First referral:', myRefsRes.body.referrals[0].referee.firstName, '-', myRefsRes.body.referrals[0].status);
    }

    // 11. Get referral config (Admin)
    console.log('\n📝 11. Getting referral config (Admin)...');
    const refConfigRes = await request(app)
        .get('/api/backoffice/referrals/config')
        .set('Authorization', `Bearer ${adminToken}`);

    if (refConfigRes.status !== 200) {
        console.error('❌ Failed to get referral config:', refConfigRes.body);
        process.exit(1);
    }
    console.log('✅ Referral config:');
    console.log('   Referrer bonus:', refConfigRes.body.referrerBonus, 'XAF');
    console.log('   Referee bonus:', refConfigRes.body.refereeBonus, 'XAF');
    console.log('   Min rides for bonus:', refConfigRes.body.minRidesForBonus);

    // 12. Update referral config (Admin)
    console.log('\n📝 12. Updating referral config (Admin)...');
    const updateConfigRes = await request(app)
        .put('/api/backoffice/referrals/config')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
            referrerBonus: 1000,
            refereeBonus: 750,
            minRidesForBonus: 2
        });

    if (updateConfigRes.status !== 200) {
        console.error('❌ Failed to update referral config:', updateConfigRes.body);
        process.exit(1);
    }
    console.log('✅ Referral config updated:');
    console.log('   New referrer bonus:', updateConfigRes.body.config.referrerBonus, 'XAF');
    console.log('   New referee bonus:', updateConfigRes.body.config.refereeBonus, 'XAF');

    // 13. Get referral stats (Admin)
    console.log('\n📝 13. Getting referral stats (Admin)...');
    const refStatsRes = await request(app)
        .get('/api/backoffice/referrals')
        .set('Authorization', `Bearer ${adminToken}`);

    if (refStatsRes.status !== 200) {
        console.error('❌ Failed to get referral stats:', refStatsRes.body);
        process.exit(1);
    }
    console.log('✅ Referral system stats:');
    console.log('   Total referrals:', refStatsRes.body.summary.totalReferrals);
    console.log('   Completed:', refStatsRes.body.summary.completedReferrals);
    console.log('   Pending:', refStatsRes.body.summary.pendingReferrals);

    // ============================================
    // CLEANUP & SUMMARY
    // ============================================
    console.log('\n========================================');
    console.log('🎉 ALL TESTS PASSED!');
    console.log('========================================\n');

    console.log('Summary:');
    console.log('✅ Promo code creation (Admin)');
    console.log('✅ Promo code listing (Admin)');
    console.log('✅ Promo code validation (Client)');
    console.log('✅ Promo code application');
    console.log('✅ Promo code reuse prevention');
    console.log('✅ Promo code stats');
    console.log('✅ Referral code generation');
    console.log('✅ Referral code application');
    console.log('✅ My referrals listing');
    console.log('✅ Referral config management (Admin)');
    console.log('✅ Referral stats (Admin)');

    await prisma.$disconnect();
}

runTests().catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
});
