# SUNKHANI — Backend

NestJS REST API for the CS Auditor platform. Handles authentication, company management, site management, and user assignment.

---

## Tech Stack

- **Framework**: NestJS 11
- **Database**: MongoDB via Mongoose
- **Auth**: JWT + Passport
- **Validation**: class-validator / class-transformer
- **Docs**: Swagger UI (`@nestjs/swagger`)

---

## Prerequisites

- Node.js >= 18
- npm >= 9
- MongoDB instance (local or Atlas)

---

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Create a `.env` file in the project root:

```env
MONGODB_URI=mongodb://localhost:27017/cs-auditor
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRATION=24h
PORT=3000
```

### 3. Seed the superadmin

Run the seeder to create the initial superadmin account:

```bash
npm run seed:superadmin
```

### 4. Start the application

```bash
# Development (watch mode)
npm run start:dev

# Production
npm run build
npm run start:prod
```

The API will be available at `http://localhost:3000/api`.

---

## Swagger Docs

Interactive API documentation is available via Swagger UI once the application is running.

**URL**: `http://localhost:3000/api/docs`

### Authenticating in Swagger

1. Call `POST /api/auth/login` to get an `accessToken`.
2. Click the **Authorize** button (top right of the Swagger page).
3. Enter `Bearer <your_accessToken>` and confirm.
4. All protected endpoints will now include the token automatically.

---

## API Overview

### Auth — `/api/auth`

| Method | Endpoint                | Auth       | Description                                |
| ------ | ----------------------- | ---------- | ------------------------------------------ |
| POST   | `/login`                | Public     | Login and receive access token             |
| POST   | `/verify-temp-password` | Public     | Set permanent password using temp password |
| POST   | `/reset-password`       | Public     | Request a new temp password                |
| POST   | `/create-admin`         | Superadmin | Create a new admin user                    |
| GET    | `/profile`              | JWT        | Get current user profile                   |

### Company — `/api/company`

All endpoints require a valid JWT token with `ADMIN` or `SUPERADMIN` role.

| Method | Endpoint                    | Description                                        |
| ------ | --------------------------- | -------------------------------------------------- |
| POST   | `/`                         | Create a company                                   |
| GET    | `/`                         | List all companies                                 |
| GET    | `/:id`                      | Get a company by ID                                |
| POST   | `/:id/invite`               | Invite a user to a company (returns temp password) |
| GET    | `/:id/users`                | List all users in a company                        |
| POST   | `/:id/sites`                | Create a site under a company                      |
| GET    | `/:id/sites`                | List all sites for a company                       |
| POST   | `/:id/sites/:siteId/assign` | Assign a user to a site                            |

---

## Scripts

| Command                   | Description                                |
| ------------------------- | ------------------------------------------ |
| `npm run start:dev`       | Start in watch mode                        |
| `npm run start:prod`      | Start compiled build                       |
| `npm run build`           | Compile TypeScript                         |
| `npm run lint`            | Lint and auto-fix                          |
| `npm run test`            | Run unit tests                             |
| `npm run test:cov`        | Run tests with coverage                    |
| `npm run seed:superadmin` | Seed initial superadmin account            |
| `npm run seed:all`        | Seed all data (clears existing data first) |

## Local Development Using Docker compose

Start local api server

```shell
cp .env.example .env
docker-compose up -d
```

- API server should be available in `https://localhost:5000/api` endpiont.
- Swagger docs can be viewed under `https://localhost:5000/api/docs`

NOTE: Wait for api server to be available. This might take couple of minutes for the first time.

Seed Database

```shell
# Seed superadmin only
docker compose exec app npm run seed:superadmin

# Seed everything (superadmin, companies, sites, admin users) — clears existing data
docker compose exec app npm run seed:all
```

Start local api server

```shell
docker compose down
```
