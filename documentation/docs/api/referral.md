---
sidebar_position: 11
title: Parrainage
description: Système de parrainage et bonus
---

# Parrainage

Système de parrainage avec bonus wallet.

## Mon Code de Parrainage

Obtenir ou générer son code unique.

<span class="badge badge--primary">GET</span> `/api/referral/my-code`

### Response

```json
{
  "referralCode": "AFRIGOABC123XYZ",
  "shareMessage": "Rejoins Afrigo avec mon code AFRIGOABC123XYZ et reçois un bonus sur ta première course! 🚗",
  "stats": {
    "totalReferrals": 5,
    "completedReferrals": 3,
    "pendingReferrals": 2,
    "totalEarned": 3000
  }
}
```

---

## Appliquer un Code de Parrainage

Pour les nouveaux utilisateurs uniquement (avant la première course).

<span class="badge badge--success">POST</span> `/api/referral/apply`

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | string | Yes | Code du parrain |

### Response

```json
{
  "success": true,
  "message": "Code de parrainage appliqué! Vous recevrez 500 XAF après votre première course.",
  "referrer": {
    "firstName": "Jean"
  },
  "bonusAmount": 500
}
```

### Erreurs Possibles

| Code | Message |
|------|---------|
| 400 | Vous avez déjà utilisé un code de parrainage |
| 400 | Le code ne peut être utilisé que par les nouveaux utilisateurs |
| 404 | Code de parrainage invalide |

---

## Mes Filleuls

Liste des personnes parrainées.

<span class="badge badge--primary">GET</span> `/api/referral/my-referrals`

### Response

```json
{
  "referrals": [
    {
      "id": "abc123",
      "referee": {
        "firstName": "Marie",
        "lastName": "D",
        "joinedAt": "2024-01-15T10:00:00Z"
      },
      "status": "COMPLETED",
      "bonus": 500,
      "createdAt": "2024-01-15T10:00:00Z",
      "completedAt": "2024-01-20T14:30:00Z"
    }
  ]
}
```

---

## Backoffice - Statistiques

<span class="badge badge--primary">GET</span> `/api/backoffice/referrals`

### Query Parameters

| Param | Type | Description |
|-------|------|-------------|
| `page` | number | Page (défaut: 1) |
| `limit` | number | Résultats par page |
| `status` | string | `PENDING`, `COMPLETED`, ou `EXPIRED` |

---

## Backoffice - Configuration

### Obtenir la configuration

<span class="badge badge--primary">GET</span> `/api/backoffice/referrals/config`

### Modifier la configuration

<span class="badge badge--warning">PUT</span> `/api/backoffice/referrals/config`

| Field | Type | Description |
|-------|------|-------------|
| `referrerBonus` | number | Bonus parrain (XAF) |
| `refereeBonus` | number | Bonus filleul (XAF) |
| `minRidesForBonus` | number | Courses requises pour débloquer le bonus |
| `isActive` | boolean | Activer/désactiver le système |
