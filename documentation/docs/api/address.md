---
sidebar_position: 4
---

# Address Management

## Add Address
Save a new address.

- **URL**: `/api/addresses`
- **Method**: `POST`
- **Headers**: `Authorization: Bearer <token>`
- **Body**:
  ```json
  {
    "label": "Home",
    "addressText": "123 Main St",
    "latitude": -4.2634,
    "longitude": 15.2429,
    "landmark": "Near Market",
    "details": "Blue Gate"
  }
  ```

## List Addresses
Get all saved addresses.

- **URL**: `/api/addresses`
- **Method**: `GET`
- **Headers**: `Authorization: Bearer <token>`

## Update Address
Edit an existing address.

- **URL**: `/api/addresses/:id`
- **Method**: `PUT`
- **Body**:
  ```json
  {
    "label": "Work",
    "details": "Office 304"
  }
  ```

## Delete Address
Remove an address.

- **URL**: `/api/addresses/:id`
- **Method**: `DELETE`
