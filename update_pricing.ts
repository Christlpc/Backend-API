import { PrismaClient, ServiceType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Congo Pricing Constants
    const configs = [
        {
            serviceType: ServiceType.TAXI,
            basePrice: 500,
            pricePerKm: 100,
            pricePerMin: 0,
            waitingPricePerMin: 100,
            minPrice: 500
        },
        {
            serviceType: ServiceType.MOTO,
            basePrice: 300,
            pricePerKm: 50,
            pricePerMin: 0,
            waitingPricePerMin: 50,
            minPrice: 300
        },
        {
            serviceType: ServiceType.CONFORT,
            basePrice: 1000,
            pricePerKm: 200,
            pricePerMin: 0,
            waitingPricePerMin: 100,
            minPrice: 1000
        },
        {
            serviceType: ServiceType.VIP,
            basePrice: 2000,
            pricePerKm: 500,
            pricePerMin: 0,
            waitingPricePerMin: 200,
            minPrice: 2000
        }
    ];

    for (const config of configs) {
        const { serviceType, ...data } = config;
        await prisma.pricingConfig.upsert({
            where: { serviceType },
            update: data as any,
            create: {
                serviceType,
                ...data,
                fuelIndex: 1.0,
                freeWaitingMinutes: 5,
                cancellationFee: 500
            } as any
        });
        console.log(`Updated config for ${serviceType}`);
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
