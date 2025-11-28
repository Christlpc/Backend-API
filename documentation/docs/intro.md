---
sidebar_position: 1
---

# Introduction

Welcome to the **Afrigo Backend API** documentation.

## Overview
Afrigo is a VTC (Voiture de Transport avec Chauffeur) application designed for the Congo market. This backend provides the core services for:
- **User Management**: Clients and Drivers.
- **Ride Booking**: Real-time estimation and booking.
- **Tracking**: Live location updates via Socket.io.
- **Payments**: Wallet system, cash, and digital payments.
- **Safety**: SOS alerts and support tickets.

## Technology Stack
- **Runtime**: Node.js
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL (via Prisma ORM)
- **Real-time**: Socket.io

## Getting Started

### Prerequisites
- Node.js (v18+)
- PostgreSQL
- npm

### Installation
1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables in `.env`:
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/afrigo"
   JWT_SECRET="your_secret_key"
   ```
4. Run migrations:
   ```bash
   npx prisma migrate dev
   ```
5. Start the server:
   ```bash
   npm run dev
   ```
