---
sidebar_position: 2
title: Rides
description: Ride estimation, booking, and ratings
---

# Rides

Calculate prices, book rides, and submit ratings.

## Estimate Ride

Get a price and duration estimate for a trip.

<span class="badge badge--success">POST</span> `/api/rides/estimate`

### Request Body

| Field | Type | Required | Description |
|---|---|---|---|
| `originLat` | number | Yes | Latitude of pickup location |
| `originLng` | number | Yes | Longitude of pickup location |
| `destLat` | number | Yes | Latitude of dropoff location |
| `destLng` | number | Yes | Longitude of dropoff location |
| `serviceType` | string | Yes | Type of service: `TAXI`, `MOTO`, `CONFORT`, `VIP` |
| `vipTier` | string | No | Required if serviceType is VIP: `Business`, `Luxury`, `XL` |

### Response

```json
{
  "distance": "5.20",
  "duration": 15,
  "estimatedPrice": 2500,
  "currency": "XAF"
}
```

---

## Request Ride

Book a new ride.

<span class="badge badge--success">POST</span> `/api/rides/request`

:::info Authentication Required
This endpoint requires a valid Bearer token in the header.
:::

### Request Body

| Field | Type | Required | Description |
|---|---|---|---|
| `originLat` | number | Yes | Pickup latitude |
| `originLng` | number | Yes | Pickup longitude |
| `originAddress` | string | No | Human-readable pickup address |
| `destLat` | number | Yes | Dropoff latitude |
| `destLng` | number | Yes | Dropoff longitude |
| `destAddress` | string | No | Human-readable dropoff address |
| `serviceType` | string | Yes | `TAXI`, `MOTO`, `CONFORT`, `VIP` |
| `estimatedPrice` | number | Yes | Price returned from estimate endpoint |
| `paymentMethod` | string | Yes | `CASH`, `WALLET`, `MOMO` |
| `passengerName` | string | No | Name of passenger (if booking for others) |
| `passengerPhone` | string | No | Phone of passenger |
| `scheduledTime` | string | No | ISO 8601 date string for scheduled rides |

### Response

```json
{
  "message": "Ride requested successfully",
  "ride": {
    "id": "clx...",
    "status": "REQUESTED",
    "estimatedPrice": 2500,
    "createdAt": "2024-01-15T10:00:00.000Z"
  }
}
```

---

## Rating System

After a ride is completed, both the client and driver can rate each other.

### Rate Driver (Client)

<span class="badge badge--success">POST</span> `/api/rides/:id/rate-driver`

#### Request Body

| Field | Type | Required | Description |
|---|---|---|---|
| `rating` | number | Yes | 1-5 stars |
| `comment` | string | No | Optional feedback |

#### Response

```json
{
  "message": "Rating submitted successfully",
  "rating": {
    "id": "clx...",
    "rating": 5,
    "raterType": "CLIENT",
    "rateeType": "DRIVER"
  }
}
```

---

### Rate Client (Driver)

<span class="badge badge--success">POST</span> `/api/rides/:id/rate-client`

#### Request Body

| Field | Type | Required | Description |
|---|---|---|---|
| `rating` | number | Yes | 1-5 stars |
| `comment` | string | No | Optional feedback |

---

### Get Ride Ratings

<span class="badge badge--primary">GET</span> `/api/rides/:id/ratings`

Returns both ratings (client→driver and driver→client) for a ride.

---

### Get My Ratings

<span class="badge badge--primary">GET</span> `/api/ratings/my`

Get your received ratings and reputation stats.

#### Response

```json
{
  "ratings": [...],
  "stats": {
    "averageRating": 4.8,
    "totalRatings": 50,
    "reputationStatus": "GOOD",
    "consecutiveBadRatings": 0
  }
}
```

#### Reputation Statuses

| Status | Description |
|---|---|
| `GOOD` | No issues |
| `WARNING` | 2 consecutive bad ratings |
| `RED_ZONE` | 3 consecutive bad ratings |
| `SUSPENDED` | 5+ consecutive bad ratings (auto-suspended) |
