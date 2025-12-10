---
sidebar_position: 6
title: Addresses
description: Manage saved addresses
---

# Addresses

Manage saved locations for quick access.

## Save Address

Add a new saved address.

<span class="badge badge--success">POST</span> `/api/addresses`

### Request Body

| Field | Type | Required | Description |
|---|---|---|---|
| `label` | string | Yes | e.g., "Home", "Work" |
| `addressText` | string | Yes | Full address string |
| `latitude` | number | Yes | Location latitude |
| `longitude` | number | Yes | Location longitude |
| `landmark` | string | No | Nearby landmark |
| `details` | string | No | Additional details |

### Response

```json
{
  "message": "Address saved",
  "address": {
    "id": 1,
    "label": "Home"
  }
}
```

---

## Get Addresses

List all saved addresses.

<span class="badge badge--primary">GET</span> `/api/addresses`

---

## Update Address

Modify an existing address.

<span class="badge badge--warning">PUT</span> `/api/addresses/:id`

### Path Parameters

| Field | Type | Description |
|---|---|---|
| `id` | number | Address ID |

### Request Body

Same fields as **Save Address**.

---

## Delete Address

Remove a saved address.

<span class="badge badge--danger">DELETE</span> `/api/addresses/:id`

### Path Parameters

| Field | Type | Description |
|---|---|---|
| `id` | number | Address ID |

### Response

```json
{
  "message": "Address deleted"
}
```
