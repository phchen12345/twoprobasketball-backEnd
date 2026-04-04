# Visitor Counter Backend

Simple Node.js backend for storing website visitor counts in PostgreSQL.

## Environment variables

Required:

```text
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DBNAME
```

Optional:

```text
PORT=4000
HOST=0.0.0.0
PGSSLMODE=disable
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
http://localhost:4000
```

## API

- `GET /health`
- `GET /api/visitors`
- `POST /api/visitors/increment`

## Database

On startup, the service creates this table automatically if it does not exist:

```sql
CREATE TABLE IF NOT EXISTS visitor_counts (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  total_visits BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ
);
```

The service keeps a single counter row with `id = 1`.
