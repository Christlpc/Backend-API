---
sidebar_position: 7
---

# Support & Safety

## Support Tickets

### Create Ticket
Submit a new support issue.

- **URL**: `/api/support/tickets`
- **Method**: `POST`
- **Headers**: `Authorization: Bearer <token>`
- **Body**:
  ```json
  {
    "subject": "Payment Issue",
    "message": "I was charged twice for ride #123."
  }
  ```

### Get Tickets
View your support ticket history.

- **URL**: `/api/support/tickets`
- **Method**: `GET`
- **Headers**: `Authorization: Bearer <token>`

## Safety

### Add Emergency Contact
Add a trusted contact for SOS alerts.

- **URL**: `/api/safety/contacts`
- **Method**: `POST`
- **Headers**: `Authorization: Bearer <token>`
- **Body**:
  ```json
  {
    "name": "Mom",
    "phone": "+242061112222"
  }
  ```

### Get Emergency Contacts
List saved emergency contacts.

- **URL**: `/api/safety/contacts`
- **Method**: `GET`
- **Headers**: `Authorization: Bearer <token>`

### Trigger SOS
Send an immediate distress alert to contacts and support.

- **URL**: `/api/safety/sos`
- **Method**: `POST`
- **Headers**: `Authorization: Bearer <token>`
- **Body**:
  ```json
  {
    "latitude": -4.2634,
    "longitude": 15.2429
  }
  ```
