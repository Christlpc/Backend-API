---
sidebar_position: 3
title: Drivers
description: Driver operations, registration, and ride management
---

# Drivers

Endpoints for driver operations including registration, document submission, and ride management.

:::info Authentication Required
All driver endpoints require a valid Bearer token.
:::

---

## Driver Registration & Onboarding

### Register as Driver

Start the driver registration process. Creates a driver profile with PENDING status.

<span class="badge badge--success">POST</span> `/api/driver/register`

#### Response

```json
{
  "message": "Driver registration started",
  "driverProfile": {
    "id": "clx...",
    "onboardingStatus": "PENDING",
    "isApproved": false
  },
  "requiredDocuments": [
    "DRIVERS_LICENSE",
    "INSURANCE",
    "VEHICLE_REGISTRATION",
    "TECHNICAL_INSPECTION",
    "DRIVER_PHOTO"
  ],
  "instructions": "Please submit all required documents to complete your registration"
}
```

---

### Submit Document

Submit a required document for verification.

<span class="badge badge--success">POST</span> `/api/driver/documents`

#### Request Body

| Field | Type | Required | Description |
|---|---|---|---|
| `type` | string | Yes | Document type (see below) |
| `documentNumber` | string | No | Document number/ID |
| `expiryDate` | string | No | Expiry date (ISO format) |
| `photoUrl` | string | Yes | URL of document photo |

#### Document Types

| Type | Description |
|---|---|
| `DRIVERS_LICENSE` | Permis de conduire |
| `INSURANCE` | Assurance véhicule |
| `VEHICLE_REGISTRATION` | Carte grise |
| `TECHNICAL_INSPECTION` | Contrôle technique |
| `DRIVER_PHOTO` | Photo du chauffeur |

#### Response

```json
{
  "message": "Document submitted successfully",
  "document": {
    "id": "clx...",
    "type": "DRIVERS_LICENSE",
    "status": "PENDING"
  },
  "allDocumentsSubmitted": false,
  "remainingDocuments": ["INSURANCE", "TECHNICAL_INSPECTION"]
}
```

---

### Get My Documents

Get all submitted documents.

<span class="badge badge--primary">GET</span> `/api/driver/documents`

#### Response

```json
{
  "documents": [
    {
      "id": "clx...",
      "type": "DRIVERS_LICENSE",
      "documentNumber": "DL123456",
      "expiryDate": "2025-12-31T00:00:00.000Z",
      "photoUrl": "https://...",
      "status": "APPROVED"
    }
  ],
  "missingDocuments": ["TECHNICAL_INSPECTION"],
  "requiredDocuments": ["DRIVERS_LICENSE", "INSURANCE", ...]
}
```

---

### Update Document

Update a previously submitted document.

<span class="badge badge--warning">PUT</span> `/api/driver/documents/:id`

#### Request Body

| Field | Type | Required | Description |
|---|---|---|---|
| `documentNumber` | string | No | New document number |
| `expiryDate` | string | No | New expiry date |
| `photoUrl` | string | No | New photo URL |

:::note
Updating a document resets its status to PENDING for re-review.
:::

---

### Get Onboarding Status

Check current registration status and next steps.

<span class="badge badge--primary">GET</span> `/api/driver/onboarding-status`

#### Response

```json
{
  "onboardingStatus": "DOCUMENTS_SUBMITTED",
  "isApproved": false,
  "canAcceptRides": false,
  "documents": {
    "total": 5,
    "submitted": 4,
    "approved": 3,
    "rejected": 1,
    "pending": 0
  },
  "rejectedDocuments": [
    {
      "type": "INSURANCE",
      "reason": "Document not readable"
    }
  ],
  "hasVehicle": true,
  "nextSteps": [
    "Resubmit 1 rejected document(s)",
    "Wait for final approval from admin"
  ]
}
```

#### Onboarding Statuses

| Status | Description |
|---|---|
| `PENDING` | Registration started, documents not yet submitted |
| `DOCUMENTS_SUBMITTED` | All documents submitted, awaiting review |
| `APPROVED` | All documents approved, driver can accept rides |
| `REJECTED` | One or more documents rejected |

---

## Vehicle Management

### Add/Update Vehicle

Add or update vehicle information.

<span class="badge badge--success">POST</span> `/api/driver/vehicle`

#### Request Body

| Field | Type | Required | Description |
|---|---|---|---|
| `make` | string | Yes | Vehicle brand (e.g., Toyota) |
| `model` | string | Yes | Vehicle model (e.g., Corolla) |
| `year` | number | Yes | Manufacturing year |
| `color` | string | Yes | Vehicle color |
| `plateNumber` | string | Yes | License plate number |
| `type` | string | Yes | `TAXI`, `MOTO`, `CONFORT`, `VIP` |

#### Response

```json
{
  "message": "Vehicle information saved",
  "vehicle": {
    "id": "clx...",
    "make": "Toyota",
    "model": "Corolla",
    "year": 2020,
    "color": "White",
    "plateNumber": "AB 1234 CD",
    "type": "TAXI"
  }
}
```

---

### Get Vehicle

Get current vehicle information.

<span class="badge badge--primary">GET</span> `/api/driver/vehicle`

---

## Driver Operations

:::warning Approval Required
The following endpoints require the driver to be fully approved (`isApproved: true`).
:::

### Toggle Availability

Set driver status to online or offline.

<span class="badge badge--success">POST</span> `/api/driver/availability`

#### Request Body

| Field | Type | Required | Description |
|---|---|---|---|
| `isAvailable` | boolean | Yes | `true` for online, `false` for offline |

#### Response

```json
{
  "message": "Availability updated",
  "isAvailable": true
}
```

---

### Update Location

Send real-time location updates.

<span class="badge badge--success">POST</span> `/api/driver/location`

#### Request Body

| Field | Type | Required | Description |
|---|---|---|---|
| `latitude` | number | Yes | Current latitude |
| `longitude` | number | Yes | Current longitude |

#### Response

```json
{
  "message": "Location updated"
}
```

---

### Get Available Rides

List requested rides nearby.

<span class="badge badge--primary">GET</span> `/api/driver/rides/available`

#### Response

```json
{
  "rides": [
    {
      "id": "clx...",
      "originAddress": "Airport",
      "destAddress": "City Center",
      "estimatedPrice": 2500,
      "serviceType": "TAXI",
      "createdAt": "2024-01-15T10:00:00.000Z"
    }
  ]
}
```

---

### Accept Ride

Accept a requested ride.

<span class="badge badge--success">POST</span> `/api/driver/rides/:id/accept`

#### Path Parameters

| Field | Type | Description |
|---|---|---|
| `id` | string | ID of the ride to accept |

#### Response

```json
{
  "message": "Ride accepted",
  "ride": {
    "id": "clx...",
    "status": "ACCEPTED",
    "driverId": "clx..."
  }
}
```

---

### Update Ride Status

Update the status of an ongoing ride.

<span class="badge badge--success">POST</span> `/api/driver/rides/:id/status`

#### Path Parameters

| Field | Type | Description |
|---|---|---|
| `id` | string | ID of the ride |

#### Request Body

| Field | Type | Required | Description |
|---|---|---|---|
| `status` | string | Yes | `IN_PROGRESS` (started) or `COMPLETED` (finished) |

#### Response

```json
{
  "message": "Ride status updated",
  "ride": {
    "id": "clx...",
    "status": "COMPLETED",
    "completedAt": "2024-01-15T10:30:00.000Z"
  }
}
```
