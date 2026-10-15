# Sunkhani Pahuna Ghar: API contract

What the backend (NestJS + MongoDB) provides and what the frontend relies on.
Base path `/api`. JSON in, JSON out.

## Conventions

- Success: `{ "data": <result> }`
- Errors: Nest's default `{ "statusCode": 400, "message": "...", "error": "Bad Request" }`.
  Date clashes use `{ "statusCode": 409, "error": "DATES_UNAVAILABLE", "message": "..." }`.
- Logged-in requests send `Authorization: Bearer <accessToken>`. Tokens last 24 hours (`JWT_EXPIRATION`).
- Dates are plain `YYYY-MM-DD`. A stay occupies the nights from check-in up to, but not including, check-out, so one guest can leave the morning another arrives. "Today" means today in Nepal (Asia/Kathmandu).
- Only **confirmed** bookings block dates. A pending request never blocks anything.
- Room types: `farm-retreat`, `main-house`. Each room type is treated as one unit (one confirmed stay at a time).
- Rate limits (per IP, per minute): 100 by default; login/register/reset 10; forgot-password 5; bookings 10; inquiries 5. Over the limit returns 429.

## Roles

| Role | How you get it |
|---|---|
| visitor | not logged in |
| `GUEST` | signing up. The API cannot create anything else. |
| `ADMIN` | only by running `npm run make-admin -- someone@example.com` on the server |

The role is read from the database on every request, not from the token, so removing admin access takes effect immediately.

## Endpoints

| Method | Path | Who | What it does |
|---|---|---|---|
| GET | `/availability?roomTypeId=` | public | Confirmed ranges `[{checkIn, checkOut}]`. No guest details. |
| POST | `/bookings` | public (login optional) | Creates a `pending` request. Links to the account when a valid token is sent. Emails the owner. |
| GET | `/bookings/mine` | logged in | Only the caller's own bookings. |
| POST | `/inquiries` | public | Contact form. Emails the owner. |
| POST | `/auth/register` | public | Creates a guest, returns `{ accessToken, user }`. |
| POST | `/auth/login` | public | Returns `{ accessToken, user }`. Same error for wrong password and unknown email. |
| GET | `/auth/me` | logged in | Current user (no password fields). |
| PATCH | `/auth/profile` | logged in | Update name and phone. |
| POST | `/auth/change-password` | logged in | `{ currentPassword, newPassword }` |
| POST | `/auth/forgot-password` | public | `{ email }`. Always answers the same, whether or not the account exists. Sends a link `FRONTEND_URL/reset-password?token=...` valid for 1 hour. The password is NOT changed at this step. |
| POST | `/auth/reset-password` | public | `{ token, newPassword }` using the emailed token (one use). |
| GET | `/admin/bookings?status=` | admin | All bookings, newest first. |
| PATCH | `/admin/bookings/:id` | admin | `{ status: "confirmed" \| "declined" \| "cancelled" }`. Confirming returns 409 `DATES_UNAVAILABLE` if it would overlap a confirmed stay. |
| GET | `/admin/inquiries` | admin | All inquiries. |

### Allowed booking status changes

`pending` to `confirmed`, `declined` or `cancelled`. `confirmed` to `cancelled`. Everything else returns 400.

### Booking request body

```json
{
  "roomTypeId": "farm-retreat",
  "checkIn": "2026-12-01",
  "checkOut": "2026-12-04",
  "guests": 2,
  "guestName": "Sita Devi",
  "guestEmail": "sita@example.com",
  "guestPhone": "+977 98...",   // optional
  "notes": "Arriving late",     // optional
  "language": "en"              // optional: "en" | "ne"
}
```

Anything else in the body (`status`, `userId`, `role`...) is silently dropped.

## Validation (server side, always)

- `roomTypeId` must be one of the two room types
- Stay: check-out after check-in, at most 60 nights, check-in not in the past and within about 2 years, real calendar dates
- `guests`: whole number 1 to 20
- `guestName` 1 to 100 characters, `guestEmail` valid and at most 254, `guestPhone` at most 30, `notes` at most 1000
- Inquiry `message` 1 to 2000
- Password 8 to 72 characters
- Control characters and new lines are stripped from single-line fields. Non-text values are rejected.

## How double-booking is prevented

Confirming a booking claims one `roomnights` document per occupied night. A unique index on `(roomTypeId, date)` makes the database refuse a second claim on the same night, even if two admins click at the same moment. If a claim fails part-way, the nights already claimed are released. Cancelling a confirmed booking frees its nights.

## Collections

```
users       { email (unique), password (hash), firstName, lastName, phoneNumber, status, role,
              passwordResetTokenHash, passwordResetExpiresAt }
bookings    { roomTypeId, checkIn, checkOut, guests, guestName, guestEmail, guestPhone, notes,
              status, language, userId|null }
roomnights  { roomTypeId, date, bookingId }   unique (roomTypeId, date)
inquiries   { name, email, message, status }
```

## Environment variables (see `.env.example`)

`MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRATION`, `PORT`, `CORS_ORIGINS` (website addresses allowed to call the API), `FRONTEND_URL`, `OWNER_EMAIL`, `SMTP_*`, `MAIL_FROM`, `TRUST_PROXY`.
Secrets live only in `.env` on the server. `.env` is never committed.

## Still to decide

- Does each room be bookable separately (3 farm rooms, 5 main-house rooms), or is a whole house booked at a time? Today it is one unit per room type.
- Where the server is hosted and who pays; Atlas or another MongoDB host for production; backups.
- Email provider for real sending (until `SMTP_HOST` is set, emails are only logged).
