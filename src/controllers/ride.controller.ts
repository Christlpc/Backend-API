import { Request, Response } from 'express';
import prisma from '../prisma';
import { AuthRequest } from '../middleware/auth.middleware';
import { getIO } from '../socket';

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
        const { originLat, originLng, destLat, destLng, serviceType, vipTier } = req.body;

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
                TAXI: { basePrice: 1000, pricePerKm: 500, pricePerMin: 50 },
                MOTO: { basePrice: 500, pricePerKm: 300, pricePerMin: 30 },
                CONFORT: { basePrice: 1500, pricePerKm: 700, pricePerMin: 70 },
                VIP: { basePrice: 2500, pricePerKm: 1000, pricePerMin: 100 }
            };
            const def = defaults[serviceType] || defaults.TAXI;
            config = await prisma.pricingConfig.create({
                data: {
                    serviceType,
                    basePrice: def.basePrice,
                    pricePerKm: def.pricePerKm,
                    pricePerMin: def.pricePerMin,
                    fuelIndex: 1.0
                }
            });
        }

        // 3. Calculate Duration (Estimate)
        // Speed: Moto=40km/h, Others=30km/h
        const speed = serviceType === 'MOTO' ? 40 : 30;
        const durationHours = distanceKm / speed;
        const durationMin = durationHours * 60;

        // 4. Traffic Factor (Simple Time-based)
        const now = new Date();
        const hour = now.getHours();
        let trafficFactor = 1.0;
        // Peak hours: 7-9 AM and 17-19 PM (5-7 PM)
        if ((hour >= 7 && hour < 9) || (hour >= 17 && hour < 19)) {
            trafficFactor = 1.5;
        }

        // 5. Calculate Price
        // Formula: Base + (km * tariff_km * fuel) + (min * tariff_min * traffic)
        let price = config.basePrice +
            (distanceKm * config.pricePerKm * config.fuelIndex) +
            (durationMin * config.pricePerMin * trafficFactor);

        // 6. VIP Multiplier
        if (serviceType === 'VIP' && vipTier) {
            const multipliers: any = { 'Business': 1.6, 'Luxury': 2.2, 'XL': 2.0 };
            const multiplier = multipliers[vipTier] || 1.0;
            price = price * multiplier;
        }

        // Round to nearest 100
        price = Math.ceil(price / 100) * 100;

        res.json({
            distance: distanceKm.toFixed(2),
            duration: Math.ceil(durationMin),
            estimatedPrice: price,
            currency: 'XAF'
        });

    } catch (error) {
        console.error('Estimate error:', error);
        res.status(500).json({ error: 'Estimation failed' });
    }
};

export const requestRide = async (req: AuthRequest, res: Response) => {
    try {
        const {
            originLat, originLng, originAddress,
            destLat, destLng, destAddress,
            serviceType, estimatedPrice,
            passengerName, passengerPhone, scheduledTime,
            paymentMethod, vipTier
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
                passengerPhone,
                scheduledTime: scheduledTime ? new Date(scheduledTime) : null,
                paymentMethod,
                vipTier
            }
        });

        // Notify all drivers (only if not scheduled for far future, but for now notify anyway)
        getIO().to('drivers').emit('new_ride_request', ride);

        res.status(201).json({ message: 'Ride requested successfully', ride });
    } catch (error) {
        console.error('Ride request error:', error);
        res.status(500).json({ error: 'Ride request failed' });
    }
};
