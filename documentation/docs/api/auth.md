---
sidebar_position: 2
---

# Authentication

## Register
Create a new user account (Client or Driver).

- **URL**: `/api/auth/register`
- **Method**: `POST`
- **Body**:
  ```json
  {
    "phone": "+242061234567",
    "password": "securepassword",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com"
  }
  ```

## Login
Authenticate and receive a JWT token.

- **URL**: `/api/auth/login`
- **Method**: `POST`
- **Body**:
  ```json
  {
    "phone": "+242061234567",
    "password": "securepassword"
  }
  ```
- **Response**:
  ```json
  {
    "message": "Login successful",
    "token": "eyJhbGciOiJIUzI1NiIsIn...",
    "user": { ... }
  }
  ```

## Get Profile
Get current user details.

- **URL**: `/api/profile`
- **Method**: `GET`
- **Headers**: `Authorization: Bearer <token>`
