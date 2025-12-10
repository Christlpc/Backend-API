---
sidebar_position: 0
slug: /
title: Introduction
description: Welcome to Afrigo Backend API Documentation
---

# Afrigo Backend API

Welcome to the official API documentation for the Afrigo VTC platform.

## Overview

This API powers the Afrigo ride-hailing platform, providing comprehensive endpoints for:

### Core Features
- **Authentication** - User registration and login
- **Rides** - Estimation, booking, and real-time management
- **Drivers** - Availability, location tracking, and ride handling
- **Wallet** - Deposits, withdrawals, and transaction history

### Driver Onboarding
- **Registration** - Become a driver with document verification
- **Documents** - Submit license, insurance, vehicle registration, technical inspection
- **Vehicle** - Register and manage vehicle information
- **Approval Workflow** - Pending → Documents Submitted → Approved

### Rating & Reputation
- **Bidirectional Ratings** - Clients rate drivers AND drivers rate clients (1-5⭐)
- **Automatic Monitoring** - Consecutive bad ratings trigger warnings
- **Auto-Suspension** - Users with too many bad ratings are automatically suspended

### Support & Safety
- **Support Tickets** - Customer service requests
- **Emergency Contacts** - SOS functionality
- **Saved Addresses** - Home, work, favorite locations

### Statistics
- **Driver Stats** - Earnings, rides completed, average duration
- **Client Stats** - Total spent, rides taken, history

### Administration (Backoffice)
- **User Management** - CRUD, status toggle, role changes
- **Driver Management** - Approval, suspension, monitoring
- **Document Review** - Validate driver documents
- **Platform Stats** - Revenue, active drivers, ride metrics
- **Rating Management** - Red zone users, reputation reset, config

## Getting Started

All API requests should be prefixed with `/api`.

Most endpoints require a Bearer token in the `Authorization` header:
```
Authorization: Bearer <your_jwt_token>
```

## API Modules

| Module | Description |
|--------|-------------|
| [Authentication](/api/authentication) | Register, login, tokens |
| [Rides](/api/rides) | Estimate, book, rate |
| [Drivers](/api/drivers) | Onboarding, documents, operations |
| [Wallet](/api/wallet) | Balance, transactions |
| [Addresses](/api/addresses) | Saved locations |
| [Statistics](/api/statistics) | Performance analytics |
| [Support & Safety](/api/support-safety) | Tickets, SOS |
| [Backoffice](/api/backoffice) | Admin-only management |

## Authentication

The API uses JWT (JSON Web Tokens) for authentication.

1. Register or login to get a token
2. Include the token in all protected requests
3. Tokens expire after 7 days

## Response Format

All responses follow this structure:

```json
{
  "message": "Success message",
  "data": { ... }
}
```

Errors return:
```json
{
  "error": "Error description"
}
```
