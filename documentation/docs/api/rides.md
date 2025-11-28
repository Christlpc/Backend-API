---
sidebar_position: 3
---

# Ride Management

## Estimate Ride
Get price and duration estimate.

- **URL**: `/api/rides/estimate`
- **Method**: `POST`
- **Body**:
  ```json
  {
    "originLat": -4.2634,
    "originLng": 15.2429,
    "destLat": -4.2700,
    "destLng": 15.2500,
    "serviceType": "TAXI" // TAXI, MOTO, CONFORT, VIP
  }
  ```

## Request Ride
Book a ride.

- **URL**: `/api/rides/request`
- **Method**: `POST`
- **Headers**: `Authorization: Bearer <token>`
- **Body**:
  ```json
  {
    "originLat": -4.2634,
    "originLng": 15.2429,
    "destLat": -4.2700,
    "destLng": 15.2500,
    "serviceType": "TAXI",
    "estimatedPrice": 1500,
    "paymentMethod": "CASH",
    "passengerName": "Jane Doe", // Optional (Booking for others)
    "passengerPhone": "+242069999999", // Optional
    "scheduledTime": "2025-11-28T10:00:00Z" // Optional
  }
  ```

## Ride Status (Socket.io)
Listen for `ride_status_update` events on the socket connection.
