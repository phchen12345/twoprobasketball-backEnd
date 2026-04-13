# Basketball Backend

Node.js backend for visitor counts, users, Google login, and notification subscriptions.

## Environment variables

Required:

```text
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DBNAME
JWT_SECRET=replace-with-a-long-random-secret
GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
```

Optional:

```text
PORT=8080
HOST=0.0.0.0
PGSSLMODE=disable
CORS_ORIGIN=http://localhost:3000
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_DAYS=30
```

`PGSSLMODE=disable` is only for local environments that do not need SSL.
On Render Postgres, keep SSL enabled and do not set it.

## Run

Install dependencies:

```bash
npm install
```

Start the server:

```bash
npm start
```

Default server:

```text
http://localhost:8080
```

## API

- `GET /health`
- `GET /api/visitors`
- `POST /api/visitors/increment`
- `POST /api/auth/google`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/notifications/subscriptions`
- `POST /api/notifications/subscriptions`
- `DELETE /api/notifications/subscriptions/:id`

### Google login

Request:

```http
POST /api/auth/google
Content-Type: application/json

{
  "idToken": "google-identity-services-id-token"
}
```

Response:

```json
{
  "accessToken": "jwt",
  "csrfToken": "csrf-token",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "User",
    "avatarUrl": "https://...",
    "role": "user"
  }
}
```

The backend also sets:

- `basketball_refresh_token`: HttpOnly cookie
- `basketball_csrf_token`: readable cookie for `X-CSRF-Token`

Use the returned access token on protected routes:

```http
Authorization: Bearer jwt
```

Use the CSRF token on state-changing cookie-authenticated routes:

```http
X-CSRF-Token: csrf-token
```

## Database

On startup, the service creates these tables automatically if they do not exist:

```sql
CREATE TABLE IF NOT EXISTS visitor_counts (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  total_visits BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ
);
```

It also creates:

- `users`
- `user_identities`
- `notification_subscriptions`
