---
sidebar_position: 6
---

# Driver Operations

## Toggle Availability
Switch driver status between online and offline.

- **URL**: `/api/driver/availability`
- **Method**: `POST`
- **Headers**: `Authorization: Bearer <token>`
- **Body**:
  ```json
  {
    "isAvailable": true
  }
  ```

## Update Location
Send real-time GPS updates.

- **URL**: `/api/driver/location`
- **Method**: `POST`
- **Headers**: `Authorization: Bearer <token>`
- **Body**:
  ```json
  {
    "lat": -4.2634,
    "lng": 15.2429
  }
  ```

## Get Available Rides
List rides requested nearby.

- **URL**: `/api/driver/rides/available`
- **Method**: `GET`
- **Headers**: `Authorization: Bearer <token>`

## Accept Ride
Accept a specific ride request.

- **URL**: `/api/driver/rides/:id/accept`
- **Method**: `POST`
- **Headers**: `Authorization: Bearer <token>`

## Update Ride Status
Change the status of an active ride (e.g., ARRIVED, IN_PROGRESS, COMPLETED).

- **URL**: `/api/driver/rides/:id/status`
- **Method**: `POST`
- **Headers**: `Authorization: Bearer <token>`
- **Body**:
  ```json
  {
    "status": "COMPLETED"
  }
  ```
