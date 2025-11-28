import prisma from '../prisma';

const COMMISSION_RATE = 0.20; // 20%

export const processPayment = async (rideId: number) => {
    try {
        const ride = await prisma.ride.findUnique({
            where: { id: rideId },
            include: { driver: true }
        });

        if (!ride || !ride.driver || !ride.finalPrice || !ride.paymentMethod) {
            throw new Error('Invalid ride data for payment processing');
        }

        const amount = ride.finalPrice;
        const commission = amount * COMMISSION_RATE;
        const netAmount = amount - commission;
        const driverUserId = ride.driver.userId;

        // Ensure driver wallet exists
        let driverWallet = await prisma.wallet.findUnique({ where: { userId: driverUserId } });
        if (!driverWallet) {
            driverWallet = await prisma.wallet.create({ data: { userId: driverUserId } });
        }

        await prisma.$transaction(async (tx) => {
            if (ride.paymentMethod === 'CASH') {
                // Cash: Driver keeps cash, we deduct commission from wallet
                await tx.transaction.create({
                    data: {
                        walletId: driverWallet!.id,
                        amount: commission,
                        type: 'COMMISSION_DEDUCTION',
                        status: 'COMPLETED'
                    }
                });

                await tx.wallet.update({
                    where: { id: driverWallet!.id },
                    data: { balance: { decrement: commission } }
                });

            } else if (ride.paymentMethod === 'WALLET') {
                // Wallet: Deduct full amount from client, credit net to driver
                const clientUserId = ride.clientId;
                let clientWallet = await tx.wallet.findUnique({ where: { userId: clientUserId } });

                if (!clientWallet || clientWallet.balance < amount) {
                    throw new Error('Insufficient client funds');
                }

                // Deduct from Client
                await tx.transaction.create({
                    data: {
                        walletId: clientWallet.id,
                        amount: amount,
                        type: 'RIDE_PAYMENT',
                        status: 'COMPLETED'
                    }
                });
                await tx.wallet.update({
                    where: { id: clientWallet.id },
                    data: { balance: { decrement: amount } }
                });

                // Credit Driver (Net)
                await tx.transaction.create({
                    data: {
                        walletId: driverWallet!.id,
                        amount: netAmount,
                        type: 'RIDE_EARNING',
                        status: 'COMPLETED'
                    }
                });
                await tx.wallet.update({
                    where: { id: driverWallet!.id },
                    data: { balance: { increment: netAmount } }
                });

            } else {
                // Digital (Mobile Money, PayPal, CB)
                // Assume platform received money, credit net to driver
                await tx.transaction.create({
                    data: {
                        walletId: driverWallet!.id,
                        amount: netAmount,
                        type: 'RIDE_EARNING',
                        status: 'COMPLETED'
                    }
                });
                await tx.wallet.update({
                    where: { id: driverWallet!.id },
                    data: { balance: { increment: netAmount } }
                });
            }

            // Update Ride Payment Status
            await tx.ride.update({
                where: { id: rideId },
                data: { paymentStatus: 'COMPLETED' }
            });
        });

        console.log(`Payment processed for ride ${rideId} via ${ride.paymentMethod}`);

    } catch (error) {
        console.error('Payment processing error:', error);
        // Update ride payment status to FAILED? Or keep PENDING?
        // For now, log error.
    }
};
