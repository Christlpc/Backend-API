import { Request, Response } from 'express';
import prisma from '../prisma';
import { AuthRequest } from '../middleware/auth.middleware';
import { getIO } from '../socket';
import { normalizePhone } from '../utils/phoneUtils';
import { handleControllerError } from '../utils/errorHandler';

// Haversine formula to calculate distance in km
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
}

function deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
}

export const estimateRide = async (req: Request, res: Response) => {
    try {
        const { originLat, originLng, destLat, destLng, serviceType, vipTier, supplements, weatherFactor = 1.0, trafficFactor = 1.0 } = req.body;

        if (!originLat || !originLng || !destLat || !destLng || !serviceType) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // 1. Calculate Distance (Haversine)
        const R = 6371; // Radius of the earth in km
        const dLat = deg2rad(destLat - originLat);
        const dLon = deg2rad(destLng - originLng);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(deg2rad(originLat)) * Math.cos(deg2rad(destLat)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distanceKm = R * c;

        // 2. Fetch Pricing Config
        let config = await prisma.pricingConfig.findUnique({ where: { serviceType } });

        // Default config if not found (Seed logic should handle this, but for safety)
        if (!config) {
            const defaults: any = {
                TAXI: { basePrice: 500, pricePerKm: 100, pricePerMin: 0 }, // Congo Defaults
                MOTO: { basePrice: 300, pricePerKm: 50, pricePerMin: 0 },
                CONFORT: { basePrice: 1000, pricePerKm: 200, pricePerMin: 0 },
                VIP: { basePrice: 2000, pricePerKm: 500, pricePerMin: 0 }
            };
            const def = defaults[serviceType] || defaults.TAXI;
            config = await prisma.pricingConfig.create({
                data: {
                    serviceType,
                    basePrice: def.basePrice,
                    pricePerKm: def.pricePerKm,
                    pricePerMin: def.pricePerMin,
                    fuelIndex: 1.0,
                    waitingPricePerMin: 100,
                    freeWaitingMinutes: 5,
                    cancellationFee: 500,
                    minPrice: 500
                }
            });
        }

        // 3. Calculate Duration (Estimate)
        const speed = serviceType === 'MOTO' ? 40 : 30;
        const durationHours = distanceKm / speed;
        const durationMin = durationHours * 60;

        // 4. Calculate Price (Congo Formula)
        // Price = Base + (Dist * Tariff * Fuel * Traffic * Weather)
        // Note: Time is NOT charged for movement

        const tarifDistance = distanceKm * config.pricePerKm * config.fuelIndex * trafficFactor * weatherFactor;
        let price = config.basePrice + tarifDistance;

        // 5. VIP Multiplier
        if (serviceType === 'VIP' && vipTier) {
            const multipliers: any = { 'Business': 1.6, 'Luxury': 2.0, 'XL': 1.4 }; // Updated multipliers
            const multiplier = multipliers[vipTier] || 1.0;
            price = price * multiplier;
        } else if (serviceType === 'CONFORT') {
            // Example mapping if needed, or rely on base price
        }

        // 6. Supplements
        if (supplements) {
            if (supplements.meetAndGreet) price += 2000;
            if (supplements.babySeat) price += 1000;
            if (supplements.extraLuggage) price += 1000;
        }

        // 7. Minimum Price (Plancher)
        if (price < config.minPrice) {
            price = config.minPrice;
        }

        // Round to nearest 100
        price = Math.ceil(price / 100) * 100;

        res.json({
            distance: distanceKm.toFixed(2),
            duration: Math.ceil(durationMin),
            estimatedPrice: price,
            currency: 'XAF',
            breakdown: {
                base: config.basePrice,
                distancePrice: tarifDistance,
                timePrice: 0, // Not charged in this model
                factors: {
                    fuel: config.fuelIndex,
                    traffic: trafficFactor,
                    weather: weatherFactor
                },
                supplements: supplements ? 'Included' : 'None',
                vipMultiplier: (serviceType === 'VIP' && vipTier) ? vipTier : 'None'
            }
        });

    } catch (error) {
        handleControllerError(res, error, 'Estimation failed');
    }
};

export const requestRide = async (req: AuthRequest, res: Response) => {
    try {
        const {
            originLat, originLng, originAddress,
            destLat, destLng, destAddress,
            serviceType, estimatedPrice,
            passengerName, passengerPhone, scheduledTime,
            paymentMethod, vipTier, supplements, billTo,
            weatherFactor = 1.0, trafficFactor = 1.0
        } = req.body;
        const userId = req.user?.userId;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!originLat || !originLng || !destLat || !destLng || !serviceType || !estimatedPrice || !paymentMethod) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        if (scheduledTime && isNaN(Date.parse(scheduledTime))) {
            return res.status(400).json({ error: 'Invalid scheduledTime format' });
        }

        const status = scheduledTime ? 'SCHEDULED' : 'REQUESTED';

        // Fetch config to get current fuel index
        const config = await prisma.pricingConfig.findUnique({ where: { serviceType } });
        const fuelIndex = config?.fuelIndex || 1.0;

        const ride = await prisma.ride.create({
            data: {
                clientId: userId,
                originLat,
                originLng,
                originAddress: originAddress || 'Unknown Origin',
                destLat,
                destLng,
                destAddress: destAddress || 'Unknown Destination',
                serviceType,
                estimatedPrice,
                status,
                passengerName,
                passengerPhone: passengerPhone ? normalizePhone(passengerPhone) : null,
                scheduledTime: scheduledTime ? new Date(scheduledTime) : null,
                paymentMethod,
                vipTier,
                supplements: supplements || undefined,
                billTo: billTo || 'CLIENT',
                weatherFactor,
                trafficFactor,
                fuelIndex
            }
        });

        // Notify all drivers
        getIO().to('drivers').emit('new_ride_request', ride);

        res.status(201).json({ message: 'Ride requested successfully', ride });
    } catch (error) {
        handleControllerError(res, error, 'Ride request failed');
    }
};
