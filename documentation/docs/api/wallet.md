---
sidebar_position: 5
title: Wallet
description: Financial transactions and balance
---

# Wallet

Manage user funds and transactions.

## Get Balance

Retrieve current wallet balance.

<span class="badge badge--primary">GET</span> `/api/wallet`

### Response

```json
{
  "balance": 15000
}
```

---

## Deposit Funds

Add funds to the wallet (Clients only).

<span class="badge badge--success">POST</span> `/api/wallet/deposit`

### Request Body

| Field | Type | Required | Description |
|---|---|---|---|
| `amount` | number | Yes | Amount to deposit (must be positive) |

### Response

```json
{
  "message": "Deposit successful",
  "balance": 20000
}
```

---

## Withdraw Funds

Withdraw funds from the wallet (Drivers only).

<span class="badge badge--success">POST</span> `/api/wallet/withdraw`

### Request Body

| Field | Type | Required | Description |
|---|---|---|---|
| `amount` | number | Yes | Amount to withdraw |

### Response

```json
{
  "message": "Withdrawal successful",
  "balance": 5000
}
```

---

## Transaction History

List all wallet transactions.

<span class="badge badge--primary">GET</span> `/api/wallet/transactions`

### Response

```json
{
  "transactions": [
    {
      "id": 1,
      "amount": 5000,
      "type": "DEPOSIT",
      "status": "COMPLETED",
      "createdAt": "2023-10-27T10:00:00.000Z"
    }
  ]
}
```
