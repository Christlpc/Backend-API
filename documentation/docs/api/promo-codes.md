---
sidebar_position: 10
title: Codes Promo
description: Gestion des codes promotionnels
---

# Codes Promo

Système de réduction pour les courses.

## Valider un Code

Vérifier un code avant de passer commande.

<span class="badge badge--success">POST</span> `/api/promo/validate`

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | string | Yes | Code promo |
| `rideAmount` | number | No | Montant estimé de la course |
| `serviceType` | string | No | Type de service (TAXI, MOTO, VIP...) |

### Response

```json
{
  "valid": true,
  "promoCode": {
    "code": "NOEL2024",
    "description": "15% de réduction",
    "discountType": "PERCENTAGE",
    "discountValue": 15
  },
  "estimatedDiscount": 750,
  "finalAmount": 4250
}
```

---

## Appliquer un Code

Appliquer un code promo à une course.

<span class="badge badge--success">POST</span> `/api/promo/apply`

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | string | Yes | Code promo |
| `rideAmount` | number | Yes | Montant de la course |
| `rideId` | string | No | ID de la course |
| `serviceType` | string | No | Type de service |

### Response

```json
{
  "success": true,
  "discount": 750,
  "originalAmount": 5000,
  "finalAmount": 4250,
  "message": "Réduction de 750 XAF appliquée"
}
```

---

## Backoffice - Créer un Code

<span class="badge badge--success">POST</span> `/api/backoffice/promo-codes`

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | string | Yes | Code unique (converti en majuscules) |
| `description` | string | No | Description du code |
| `discountType` | string | Yes | `PERCENTAGE` ou `FIXED` |
| `discountValue` | number | Yes | Valeur de réduction |
| `maxUses` | number | No | Limite d'utilisations totales |
| `maxUsesPerUser` | number | No | Limite par utilisateur (défaut: 1) |
| `minRideAmount` | number | No | Montant minimum de course |
| `startsAt` | string | No | Date de début (ISO) |
| `expiresAt` | string | No | Date d'expiration (ISO) |
| `serviceTypes` | array | No | Services éligibles |

---

## Backoffice - Lister les Codes

<span class="badge badge--primary">GET</span> `/api/backoffice/promo-codes`

### Query Parameters

| Param | Type | Description |
|-------|------|-------------|
| `page` | number | Page (défaut: 1) |
| `limit` | number | Résultats par page (défaut: 10) |
| `status` | string | `active`, `inactive`, ou `expired` |
| `search` | string | Recherche par code ou description |

---

## Backoffice - Autres Endpoints

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/backoffice/promo-codes/:id` | Détails d'un code |
| PUT | `/backoffice/promo-codes/:id` | Modifier un code |
| PATCH | `/backoffice/promo-codes/:id/toggle` | Activer/désactiver |
| DELETE | `/backoffice/promo-codes/:id` | Supprimer |
| GET | `/backoffice/promo-codes/:id/stats` | Statistiques d'utilisation |
