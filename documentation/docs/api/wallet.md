---
sidebar_position: 5
---

# Wallet System

## Get Balance
Get the current user's wallet balance.

- **URL**: `/api/wallet`
- **Method**: `GET`
- **Headers**: `Authorization: Bearer <token>`
- **Response**:
  ```json
  {
    "balance": 5000,
    "currency": "XAF"
  }
  ```

## Deposit Funds
Add funds to the wallet (Client only).

- **URL**: `/api/wallet/deposit`
- **Method**: `POST`
- **Headers**: `Authorization: Bearer <token>`
- **Body**:
  ```json
  {
    "amount": 10000
  }
  ```

## Withdraw Funds
Withdraw funds from the wallet (Driver only).

- **URL**: `/api/wallet/withdraw`
- **Method**: `POST`
- **Headers**: `Authorization: Bearer <token>`
- **Body**:
  ```json
  {
    "amount": 5000
  }
  ```

## Transaction History
Get a list of past transactions.

- **URL**: `/api/wallet/transactions`
- **Method**: `GET`
- **Headers**: `Authorization: Bearer <token>`
- **Response**:
  ```json
  {
    "transactions": [
      {
        "id": 1,
        "amount": 1000,
        "type": "DEPOSIT", // DEPOSIT, WITHDRAWAL, RIDE_PAYMENT, RIDE_EARNING
        "status": "COMPLETED",
        "createdAt": "2025-11-28T10:00:00Z"
      }
    ]
  }
  ```
