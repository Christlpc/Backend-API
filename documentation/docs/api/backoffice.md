---
sidebar_position: 9
title: Backoffice
description: Admin endpoints for platform management
---

# Backoffice API

Endpoints for platform administration. All endpoints require **ADMIN** role.

:::danger Admin Only
All backoffice endpoints require authentication with an admin account. Non-admin users will receive a `403 Forbidden` response.
:::

---

## User Management

### List All Users

Get paginated list of users with optional filters.

<span class="badge badge--primary">GET</span> `/api/backoffice/users`

#### Query Parameters

| Field | Type | Required | Description |
|---|---|---|---|
| `page` | number | No | Page number (default: 1) |
| `limit` | number | No | Items per page (default: 20) |
| `role` | string | No | Filter by role: `CLIENT`, `DRIVER`, `ADMIN` |
| `status` | string | No | Filter by status: `active`, `inactive` |
| `search` | string | No | Search in phone, email, firstName, lastName |

#### Response

```json
{
  "users": [
    {
      "id": "clx...",
      "phone": "+242064000000",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "CLIENT",
      "isActive": true,
      "createdAt": "2024-01-15T10:00:00.000Z",
      "_count": { "ridesAsClient": 15 }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

---

### Get User Details

<span class="badge badge--primary">GET</span> `/api/backoffice/users/:id`

#### Response

```json
{
  "user": {
    "id": "clx...",
    "phone": "+242064000000",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "DRIVER",
    "isActive": true,
    "driverProfile": {
      "id": "clx...",
      "isApproved": true,
      "vehicle": { ... }
    },
    "wallet": { "balance": 25000 },
    "_count": {
      "ridesAsClient": 15,
      "reviewsGiven": 12,
      "supportTickets": 2
    }
  }
}
```

---

### Update User

<span class="badge badge--warning">PUT</span> `/api/backoffice/users/:id`

#### Request Body

| Field | Type | Required | Description |
|---|---|---|---|
| `firstName` | string | No | |
| `lastName` | string | No | |
| `email` | string | No | |
| `phone` | string | No | |

---

### Toggle User Status

Activate or suspend a user account.

<span class="badge badge--warning">PATCH</span> `/api/backoffice/users/:id/status`

#### Request Body

| Field | Type | Required | Description |
|---|---|---|---|
| `reason` | string | No | Reason for suspension |

---

### Change User Role

<span class="badge badge--warning">PATCH</span> `/api/backoffice/users/:id/role`

#### Request Body

| Field | Type | Required | Description |
|---|---|---|---|
| `role` | string | Yes | `CLIENT`, `DRIVER`, or `ADMIN` |

---

### Delete User

<span class="badge badge--danger">DELETE</span> `/api/backoffice/users/:id`

#### Query Parameters

| Field | Type | Required | Description |
|---|---|---|---|
| `hardDelete` | boolean | No | If `true`, permanently deletes. Default: soft delete |

---

## Driver Management

### List All Drivers

<span class="badge badge--primary">GET</span> `/api/backoffice/drivers`

#### Query Parameters

| Field | Type | Required | Description |
|---|---|---|---|
| `page` | number | No | Page number |
| `limit` | number | No | Items per page |
| `status` | string | No | `approved`, `pending` |
| `available` | boolean | No | Filter by availability |

---

### Get Driver Details

<span class="badge badge--primary">GET</span> `/api/backoffice/drivers/:id`

Returns driver profile with stats (total rides, revenue, rating).

---

### Approve Driver

<span class="badge badge--warning">PATCH</span> `/api/backoffice/drivers/:id/approve`

Approves a pending driver registration.

---

### Suspend Driver

<span class="badge badge--warning">PATCH</span> `/api/backoffice/drivers/:id/suspend`

#### Request Body

| Field | Type | Required | Description |
|---|---|---|---|
| `reason` | string | No | Reason for suspension |

---

## Document Review

### Get Pending Documents

<span class="badge badge--primary">GET</span> `/api/backoffice/documents/pending`

Returns all driver documents awaiting review.

---

### Review Document

Approve or reject a driver document.

<span class="badge badge--warning">PATCH</span> `/api/backoffice/documents/:id/review`

#### Request Body

| Field | Type | Required | Description |
|---|---|---|---|
| `action` | string | Yes | `APPROVE` or `REJECT` |
| `rejectionReason` | string | Conditional | Required if rejecting |

#### Response

```json
{
  "message": "Document approved successfully",
  "document": { ... },
  "driverFullyApproved": true
}
```

---

### Get Driver Documents

<span class="badge badge--primary">GET</span> `/api/backoffice/drivers/:id/documents`

Returns all documents for a specific driver.

---

## Platform Statistics

### Get Platform Stats

<span class="badge badge--primary">GET</span> `/api/backoffice/stats`

#### Response

```json
{
  "users": { "total": 1500, "newToday": 12 },
  "drivers": { "total": 50, "active": 25, "pending": 5 },
  "rides": {
    "total": 5000,
    "completed": 4500,
    "cancelled": 200,
    "today": 45,
    "completionRate": "90.0"
  },
  "revenue": {
    "total": 25000000,
    "today": 450000,
    "currency": "XAF"
  }
}
```

---

### Get Revenue Stats

<span class="badge badge--primary">GET</span> `/api/backoffice/stats/revenue`

#### Query Parameters

| Field | Type | Required | Description |
|---|---|---|---|
| `period` | string | No | `day`, `week`, `month` (default: week) |

---

### Get Active Drivers Map

<span class="badge badge--primary">GET</span> `/api/backoffice/stats/drivers-map`

Returns currently online drivers with their locations.

---

## Ride Management

### List All Rides

<span class="badge badge--primary">GET</span> `/api/backoffice/rides`

#### Query Parameters

| Field | Type | Required | Description |
|---|---|---|---|
| `status` | string | No | Filter by status |
| `serviceType` | string | No | `TAXI`, `MOTO`, `CONFORT`, `VIP` |
| `dateFrom` | string | No | ISO date |
| `dateTo` | string | No | ISO date |

---

### Get Ride Details

<span class="badge badge--primary">GET</span> `/api/backoffice/rides/:id`

---

### Cancel Ride

<span class="badge badge--warning">PATCH</span> `/api/backoffice/rides/:id/cancel`

#### Request Body

| Field | Type | Required | Description |
|---|---|---|---|
| `reason` | string | No | Cancellation reason |

---

## Transaction Management

### List All Transactions

<span class="badge badge--primary">GET</span> `/api/backoffice/transactions`

#### Query Parameters

| Field | Type | Required | Description |
|---|---|---|---|
| `type` | string | No | `DEPOSIT`, `WITHDRAWAL`, `RIDE_PAYMENT`, `RIDE_EARNING` |
| `status` | string | No | `PENDING`, `COMPLETED`, `FAILED` |

---

### Get Transaction Details

<span class="badge badge--primary">GET</span> `/api/backoffice/transactions/:id`
