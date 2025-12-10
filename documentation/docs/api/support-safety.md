---
sidebar_position: 4
title: Support & Safety
description: Customer support and emergency features
---

# Support & Safety

Manage support tickets and safety features.

## Support Tickets

### Create Ticket

Submit a new support request.

<span class="badge badge--success">POST</span> `/api/support/tickets`

#### Request Body

| Field | Type | Required | Description |
|---|---|---|---|
| `subject` | string | Yes | Title of the issue |
| `description` | string | Yes | Detailed description |
| `category` | string | Yes | `RIDE`, `PAYMENT`, `ACCOUNT`, `OTHER` |

#### Response

```json
{
  "message": "Ticket created",
  "ticket": {
    "id": 1,
    "subject": "Lost Item",
    "status": "OPEN"
  }
}
```

### Get Tickets

List all support tickets for the user.

<span class="badge badge--primary">GET</span> `/api/support/tickets`

---

## Safety

### Add Emergency Contact

Add a trusted contact for SOS alerts.

<span class="badge badge--success">POST</span> `/api/safety/contacts`

#### Request Body

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | Yes | Contact name |
| `phone` | string | Yes | Contact phone number |

### Get Emergency Contacts

List all emergency contacts.

<span class="badge badge--primary">GET</span> `/api/safety/contacts`

### Trigger SOS

Send an emergency alert to all contacts.

<span class="badge badge--danger">POST</span> `/api/safety/sos`

#### Request Body

| Field | Type | Required | Description |
|---|---|---|---|
| `lat` | number | Yes | Current latitude |
| `lng` | number | Yes | Current longitude |

#### Response

```json
{
  "message": "SOS alert sent",
  "notifiedCount": 2
}
```
