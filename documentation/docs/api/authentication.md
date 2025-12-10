---
sidebar_position: 1
title: Authentication
description: User registration and login endpoints
---

# Authentication

Manage user access and sessions.

## Register User

Create a new user account.

<span class="badge badge--success">POST</span> `/api/auth/register`

### Request Body

| Field | Type | Required | Description |
|---|---|---|---|
| `phone` | string | Yes | User's phone number (unique identifier) |
| `email` | string | No | User's email address |
| `password` | string | Yes | User's password |
| `firstName` | string | No | First name |
| `lastName` | string | No | Last name |

### Response

```json
{
  "message": "User registered successfully",
  "userId": 1
}
```

---

## Login

Authenticate a user and retrieve an access token.

<span class="badge badge--success">POST</span> `/api/auth/login`

### Request Body

| Field | Type | Required | Description |
|---|---|---|---|
| `phone` | string | Yes | User's phone number |
| `password` | string | Yes | User's password |

### Response

```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR...",
  "user": {
    "id": 1,
    "phone": "+242061234567",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "CLIENT"
  }
}
```
