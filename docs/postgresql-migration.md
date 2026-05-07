# PostgreSQL Migration Guide

This document covers migrating LineupCast OS from SQLite to PostgreSQL for
production deployments.

## Prerequisites

- **PostgreSQL 16+** (tested with 16.x; 17.x also supported)
- **Python 3.11+** with SQLAlchemy 2.0+
- **pip** packages:
  ```
  pip install sqlalchemy>=2.0 psycopg2-binary>=2.9 alembic>=1.13
  ```
- A running PostgreSQL instance with a dedicated database

## Quick Start

### 1. Install Dependencies

```bash
cd apps/api
pip install -r requirements.txt
pip install sqlalchemy psycopg2-binary alembic
```

Add the following to `requirements.txt` if not already present:

```
sqlalchemy>=2.0.0
psycopg2-binary>=2.9.0
alembic>=1.13.0
```

### 2. Set the Database URL

Export the connection string as an environment variable:

```bash
export LINEUPCAST_DATABASE_URL="postgresql+psycopg2://user:password@localhost:5432/lineupcast"
```

For production, use a secrets manager or environment file. The URL follows
SQLAlchemy's standard format:

```
postgresql+psycopg2://USER:PASSWORD@HOST:PORT/DBNAME?sslmode=require
```

### 3. Create the Database

```sql
-- Connect as a superuser
CREATE DATABASE lineupcast;
CREATE USER lineupcast_app WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE lineupcast TO lineupcast_app;
```

### 4. Initialize the Schema

The schema can be bootstrapped programmatically:

```python
from apps.api.app.database import init_db

init_db()  # Creates all tables from models.py (idempotent)
```

Or via Alembic (recommended for production -- see below).

## Schema Overview

All tables are defined in `apps/api/app/models.py` using SQLAlchemy 2.0
mapped_column syntax. The `database.py` module provides engine/session
lifecycle management.

### Entity-Relationship Diagram (Text)

```
                              +---------------------+
                              |     providers       |
                              +---------------------+
                              | id (PK)             |
                              | name (UQ)           |
                              | status              |
                              | last_sync           |
                              | error_count         |
                              | last_error          |
                              | capabilities (JSON) |
                              | created_at          |
                              | updated_at          |
                              +----------+----------+
                                         |
                                         | 1:N
                                         v
                              +---------------------+
                              |   provider_runs     |
                              +---------------------+
                              | id (PK)             |
                              | provider_id (FK)    |
                              | status              |
                              | records_synced      |
                              | duration_ms         |
                              | error_message       |
                              | created_at          |
                              +---------------------+

  +---------------------+              +---------------------+
  |       teams         |              |      matches        |
  +---------------------+              +---------------------+
  | id (PK)             |<---+   +---->| id (PK)             |
  | external_id (UQ)    |    |   |     | external_id (UQ)    |
  | name                |    |   |     | home_team_id (FK) --+
  | short_name          |    |   |     | away_team_id (FK) --+
  | league              |    |   |     | league              |
  | country             |    |   |     | season              |
  | founded             |    |   |     | matchday            |
  | venue               |    |   |     | kickoff             |
  | crest               |    |   |     | venue               |
  | created_at          |    |   |     | referee             |
  | updated_at          |    |   |     | status              |
  +----------+----------+    |   |     | home_score          |
             |               |   |     | away_score          |
             | 1:N           |   |     | minute              |
             v               |   |     | data_source         |
  +---------------------+    |   |     | created_at          |
  |      players        |    |   |     | updated_at          |
  +---------------------+    |   |     +----------+----------+
  | id (PK)             |    |   |                |
  | external_id (UQ)    |    |   |       +--------+--------+
  | team_id (FK)  ------+----+   |       |        |        |
  | name                |        |       v        v        v
  | position            |    +---+---+  +---+  +-------+  +----------+
  | shirt_number        |    |lineups|  |pre|  |scripts|  |prediction|
  | nationality         |    +-------+  |dic|  +-------+  |_inputs   |
  | date_of_birth       |    | id    |  |tio|  | id    |  +----------+
  | height              |    |match_ |  |ns |  |match_ |  | id       |
  | weight              |    |id (FK)|  +---+  |id (FK)|  |predicti- |
  | injured             |    |team_  |  | id  | |lang   |  |on_id(FK)|
  | injury_note         |    |id(FK) |  |match| |style  |  |input_   |
  | created_at          |    |forma- |  |_id  | |durat- |  |type     |
  | updated_at          |    |tion   |  |home_| |ion    |  |input_   |
  +----------+----------+    |coach  |  |win  | |title  |  |data(SON)|
             |               |created|  |draw | |content|  |created  |
             |               |updated|  |away_| |ground_|  |  _at    |
             |               +---+---+  |win  | |ing    |  +---------+
             |                   |       |expec| |data   |
             | N:M               v       |ted  | |provide|
             v               +----------+|home_| |r      |
  +---------------------+    |lineup   ||goals| |model  |
  |    lineup_players   |    |_players ||expec| |latency|
  +---------------------+    +----------+|ted  | |ms     |
  | lineup_id (PK, FK)  |    |lineup_  ||away_| |fallbac|
  | player_id (PK, FK)  |    |id (FK)  ||goals| |k      |
  | is_starter          |    |player_  ||conf-| |created|
  | position            |    |id (FK)  ||iden-| +-------+
  | x                   |    |is_start ||ce   |
  | y                   |    |er       ||model|
  +---------------------+    |position ||_name|
                             |x        ||model|
             +---------------+y        ||_vers|
             |               +----------+|ion  |
             v                           |data_|
  +---------------------+                |compl|
  |player_stats_snapshot|                |ete  |
  +---------------------+                |scor |
  | id (PK)             |                |creat|
  | player_id (FK)      |                +-----+
  | season              |
  | appearances         |
  | goals               |
  | assists             |
  | xg                  |
  | xa                  |
  | yellow_cards        |
  | red_cards           |
  | minutes_played      |
  | rating              |
  | data_source         |
  | snapshot_date       |
  | created_at          |
  +---------------------+
```

### Table Summary

| Table                   | Purpose                                | Key FKs                      |
|-------------------------|----------------------------------------|------------------------------|
| `providers`             | External data sources                  | --                           |
| `provider_runs`         | Sync run log per provider              | `provider_id` -> providers   |
| `teams`                 | Football clubs                         | --                           |
| `matches`               | Fixtures and results                   | `home/away_team_id` -> teams |
| `players`               | Individual players                     | `team_id` -> teams           |
| `lineups`               | Team lineups per match                 | `match_id` -> matches        |
|                         |                                        | `team_id` -> teams           |
| `lineup_players`        | Player-lineup association (M:N)        | `lineup_id` -> lineups       |
|                         |                                        | `player_id` -> players       |
| `player_stats_snapshots`| Aggregated player stats over time      | `player_id` -> players       |
| `predictions`           | Match outcome predictions              | `match_id` -> matches        |
| `prediction_inputs`     | Raw inputs captured per prediction     | `prediction_id` -> predictions|
| `scripts`               | Generated broadcast scripts            | `match_id` -> matches        |

## Alembic Setup (Recommended for Production)

### Initialize Alembic

```bash
cd apps/api
alembic init alembic
```

### Configure `alembic.ini`

```ini
[alembic]
script_location = alembic
sqlalchemy.url = postgresql+psycopg2://user:password@localhost:5432/lineupcast
```

### Configure `alembic/env.py`

```python
from apps.api.app.models import Base

target_metadata = Base.metadata
```

### Generate and Run Migrations

```bash
# Generate an initial migration from the ORM models
alembic revision --autogenerate -m "initial schema"

# Apply the migration
alembic upgrade head

# Check current version
alembic current

# View history
alembic history
```

## Migrating from SQLite

If you have an existing SQLite database (`apps/api/data/lineupcast.db`) with
data you want to preserve:

### Option A: Export/Import (Recommended for Small Datasets)

```bash
# 1. Export from SQLite
sqlite3 apps/api/data/lineupcast.db ".dump" > dump.sql

# 2. Clean up SQLite-specific syntax
sed -i '' 's/AUTOINCREMENT/SERIAL/g' dump.sql
sed -i '' 's/INTEGER PRIMARY KEY/SERIAL PRIMARY KEY/g' dump.sql

# 3. Import into PostgreSQL
psql -U lineupcast_app -d lineupcast -f dump.sql
```

### Option B: Python Script

```python
import sqlite3
from apps.api.app.database import get_session
from apps.api.app.models import Match, Team, Player

# Read from SQLite
conn = sqlite3.connect("apps/api/data/lineupcast.db")
conn.row_factory = sqlite3.Row

with get_session() as pg_session:
    for row in conn.execute("SELECT * FROM matches"):
        pg_session.add(Match(
            external_id=row["match_id"],
            league=row.get("competition"),
            status=row.get("status", "scheduled"),
            # ... map remaining columns
        ))

conn.close()
```

### Option C: Start Fresh (Recommended for Development)

Simply point `LINEUPCAST_DATABASE_URL` to PostgreSQL and call `init_db()`.
Seed data will be reloaded on first request via the service layer's
`_ensure_seed_data()` function.

## Key Differences: SQLite vs PostgreSQL

| Feature               | SQLite (dev)           | PostgreSQL (prod)        |
|-----------------------|------------------------|--------------------------|
| JSON columns          | TEXT (JSON stored as str)| JSONB (indexed, queryable)|
| Concurrent writes     | WAL mode, serialized   | MVCC, true concurrency   |
| Full-text search      | FTS5 extension         | `tsvector` / `pg_trgm`   |
| Connection pooling    | N/A (file-based)       | Built-in via SQLAlchemy  |
| Data types            | Flexible/loose         | Strict type enforcement  |
| Index types           | B-tree only            | B-tree, GIN, GiST, BRIN |

## Environment Variables

| Variable                    | Default                        | Description                    |
|-----------------------------|--------------------------------|--------------------------------|
| `LINEUPCAST_DATABASE_URL`   | `sqlite:///data/lineupcast.db` | SQLAlchemy connection string   |

Set to a PostgreSQL URL for production:

```bash
LINEUPCAST_DATABASE_URL="postgresql+psycopg2://user:pass@host:5432/lineupcast"
```

## Troubleshooting

### Connection Refused

```bash
# Check PostgreSQL is running
pg_isready -h localhost -p 5432

# Check authentication
psql -U lineupcast_app -d lineupcast -c "SELECT 1"
```

### Permission Denied

```sql
-- Grant schema permissions
GRANT USAGE ON SCHEMA public TO lineupcast_app;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO lineupcast_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO lineupcast_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL PRIVILEGES ON TABLES TO lineupcast_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL PRIVILEGES ON SEQUENCES TO lineupcast_app;
```

### JSONB Queries (PostgreSQL-Specific)

```sql
-- Find providers with a specific capability
SELECT * FROM providers
WHERE capabilities->>'matches' = 'true';

-- Search prediction inputs by type
SELECT * FROM prediction_inputs
WHERE input_type = 'lineup'
  AND input_data @> '{"formation": "4-3-3"}';
```

### Index Recommendations for Production

The models include indexes on foreign keys and commonly queried columns.
For high-traffic deployments, consider adding:

```sql
-- Composite index for match lookups by league+season+status
CREATE INDEX CONCURRENTLY ix_matches_league_season_status
  ON matches (league, season, status);

-- GIN index on JSONB columns for capability queries
CREATE INDEX CONCURRENTLY ix_providers_capabilities
  ON providers USING GIN (capabilities);

-- GIN index on prediction input data
CREATE INDEX CONCURRENTLY ix_prediction_inputs_data
  ON prediction_inputs USING GIN (input_data);
```
