---
sidebar_position: 7
title: Statistics
description: Performance and usage analytics
---

# Statistics

Get insights into usage and performance.

## Driver Statistics

Get performance metrics for drivers.

<span class="badge badge--primary">GET</span> `/api/stats/driver`

### Query Parameters

| Field | Type | Default | Description |
|---|---|---|---|
| `timeframe` | string | `day` | `day`, `week`, or `month` |

### Response

```json
{
  "timeframe": "day",
  "totalRides": 5,
  "totalRevenue": 15000,
  "totalEarnings": 12000,
  "avgDurationMinutes": 25,
  "currency": "XAF"
}
```

---

## Client Statistics

Get usage metrics for clients.

<span class="badge badge--primary">GET</span> `/api/stats/client`

### Query Parameters

| Field | Type | Default | Description |
|---|---|---|---|
| `timeframe` | string | `day` | `day`, `week`, or `month` |

### Response

```json
{
  "timeframe": "week",
  "totalRides": 3,
  "totalSpent": 4500,
  "avgDurationMinutes": 15,
  "currency": "XAF"
}
```
