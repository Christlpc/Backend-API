---
sidebar_position: 12
title: Notifications
description: Push notifications and in-app notifications
---

# Notifications

Système de notifications push et in-app.

## Enregistrer un Token FCM

Enregistrer le token Firebase Cloud Messaging pour recevoir des notifications push.

<span class="badge badge--success">POST</span> `/api/notifications/register-token`

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `fcmToken` | string | Yes | Token FCM du device |

### Response

```json
{
  "message": "Token FCM enregistré",
  "success": true
}
```

---

## Supprimer le Token FCM

Supprimer le token FCM (lors de la déconnexion).

<span class="badge badge--danger">DELETE</span> `/api/notifications/unregister-token`

---

## Mes Notifications

Liste paginée des notifications.

<span class="badge badge--primary">GET</span> `/api/notifications`

### Query Parameters

| Param | Type | Description |
|-------|------|-------------|
| `page` | number | Page (défaut: 1) |
| `limit` | number | Résultats par page (défaut: 20) |
| `unreadOnly` | boolean | Uniquement les non lues |

### Response

```json
{
  "notifications": [
    {
      "id": "abc123",
      "title": "Chauffeur arrivé! 📍",
      "body": "Votre chauffeur vous attend",
      "type": "RIDE",
      "isRead": false,
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ],
  "unreadCount": 3,
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 15
  }
}
```

---

## Nombre de Non Lues

<span class="badge badge--primary">GET</span> `/api/notifications/unread-count`

---

## Marquer comme Lu

<span class="badge badge--warning">PATCH</span> `/api/notifications/:id/read`

---

## Tout Marquer comme Lu

<span class="badge badge--warning">PATCH</span> `/api/notifications/read-all`

---

## Types de Notifications

| Type | Description |
|------|-------------|
| `RIDE` | Course acceptée, chauffeur arrivé, terminée |
| `PAYMENT` | Paiement reçu |
| `REFERRAL` | Bonus parrainage |
| `PROMO` | Code promo appliqué |
| `DOCUMENT` | Document approuvé/rejeté |
| `SYSTEM` | Notifications système |

---

## Backoffice - Envoyer Notification

<span class="badge badge--success">POST</span> `/api/backoffice/notifications/send`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | string | Yes | ID de l'utilisateur |
| `title` | string | Yes | Titre |
| `body` | string | Yes | Message |
| `type` | string | No | Type (défaut: SYSTEM) |

---

## Backoffice - Broadcast

Envoyer à tous les utilisateurs ou un rôle spécifique.

<span class="badge badge--success">POST</span> `/api/backoffice/notifications/broadcast`

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Titre |
| `body` | string | Message |
| `type` | string | Type de notification |
| `role` | string | Optionnel: CLIENT, DRIVER |
