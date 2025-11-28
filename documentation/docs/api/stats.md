---
sidebar_position: 8
---

# Statistics & Analytics

## Driver Statistics
Get performance metrics for the authenticated driver.

- **URL**: `/api/stats/driver`
- **Method**: `GET`
- **Headers**: `Authorization: Bearer <token>`
- **Query Parameters**:
  - `timeframe`: `day` | `week` | `month` (default: `day`)
- **Response**:
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

## Client Statistics
Get usage metrics for the authenticated client.

- **URL**: `/api/stats/client`
- **Method**: `GET`
- **Headers**: `Authorization: Bearer <token>`
- **Query Parameters**:
  - `timeframe`: `day` | `week` | `month` (default: `day`)
- **Response**:
  ```json
  {
    "timeframe": "week",
    "totalRides": 3,
    "totalSpent": 4500,
    "avgDurationMinutes": 15,
    "currency": "XAF"
  }
  ```
