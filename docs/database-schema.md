# Database Schema

LineupCast OS uses **SQLAlchemy ORM** with a dual-database strategy:

- **SQLite** (development): zero-config local storage, WAL mode, JSON columns
- **PostgreSQL 16+** (production): JSONB columns, full-text search, concurrent writes

All timestamps are stored in **UTC**. Primary keys are auto-incrementing integers unless otherwise noted.

---

## Tables

### providers

External data providers (e.g. football-data.org, StatsBomb).

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | INTEGER | PK, autoincrement | |
| name | VARCHAR(128) | NOT NULL, UNIQUE | Provider identifier |
| status | VARCHAR(32) | NOT NULL, default `'active'` | `active` / `degraded` / `disabled` |
| last_sync | TIMESTAMPTZ | | Last successful sync timestamp |
| error_count | INTEGER | NOT NULL, default 0 | Consecutive error count |
| last_error | TEXT | | Most recent error message |
| capabilities | JSONB | | Feature flags, e.g. `{"matches": true}` |
| created_at | TIMESTAMPTZ | NOT NULL, server_default=now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, server_default=now() | Auto-updated on write |

### provider_runs

A single sync run executed by a provider.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | INTEGER | PK, autoincrement | |
| provider_id | INTEGER | FK -> providers.id ON DELETE CASCADE, NOT NULL | |
| status | VARCHAR(32) | NOT NULL, default `'synced'` | `synced` / `failed` / `partial` |
| records_synced | INTEGER | NOT NULL, default 0 | |
| duration_ms | INTEGER | | Run duration in milliseconds |
| error_message | TEXT | | Error detail if status is `failed` |
| created_at | TIMESTAMPTZ | NOT NULL, server_default=now() | |

**Indexes:** `ix_provider_runs_provider_id`, `ix_provider_runs_created_at`

### teams

Football teams / clubs.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | INTEGER | PK, autoincrement | |
| external_id | VARCHAR(64) | UNIQUE | Provider-specific team ID |
| name | VARCHAR(256) | NOT NULL | Full name |
| short_name | VARCHAR(32) | | Abbreviated name |
| league | VARCHAR(128) | | Competition name |
| country | VARCHAR(64) | | Country code or name |
| founded | INTEGER | | Year founded |
| venue | VARCHAR(256) | | Home stadium |
| crest | VARCHAR(512) | | URL to team crest image |
| created_at | TIMESTAMPTZ | NOT NULL, server_default=now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, server_default=now() | |

**Indexes:** `ix_teams_league`, `ix_teams_external_id`

### matches

A single football match.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | INTEGER | PK, autoincrement | |
| external_id | VARCHAR(64) | UNIQUE | Provider-specific match ID |
| home_team_id | INTEGER | FK -> teams.id ON DELETE SET NULL | |
| away_team_id | INTEGER | FK -> teams.id ON DELETE SET NULL | |
| league | VARCHAR(128) | | Competition name |
| season | VARCHAR(32) | | e.g. `"2025/26"` |
| matchday | INTEGER | | Round / matchday number |
| kickoff | TIMESTAMPTZ | | Scheduled kick-off time |
| venue | VARCHAR(256) | | Stadium name |
| referee | VARCHAR(128) | | |
| status | VARCHAR(32) | NOT NULL, default `'scheduled'` | `scheduled` / `live` / `finished` / `postponed` / `cancelled` |
| home_score | INTEGER | | |
| away_score | INTEGER | | |
| minute | INTEGER | | Current minute if `live` |
| data_source | VARCHAR(64) | | Provider name that supplied the data |
| created_at | TIMESTAMPTZ | NOT NULL, server_default=now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, server_default=now() | |

**Indexes:** `ix_matches_external_id`, `ix_matches_league_season`, `ix_matches_kickoff`, `ix_matches_status`

### players

Individual football players.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | INTEGER | PK, autoincrement | |
| external_id | VARCHAR(64) | UNIQUE | Provider-specific player ID |
| team_id | INTEGER | FK -> teams.id ON DELETE SET NULL | |
| name | VARCHAR(256) | NOT NULL | Full name |
| position | VARCHAR(32) | | `GK` / `DEF` / `MID` / `FWD` |
| shirt_number | INTEGER | | |
| nationality | VARCHAR(64) | | |
| date_of_birth | DATE | | |
| height | INTEGER | | Height in cm |
| weight | INTEGER | | Weight in kg |
| injured | BOOLEAN | NOT NULL, default false | |
| injury_note | TEXT | | |
| created_at | TIMESTAMPTZ | NOT NULL, server_default=now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, server_default=now() | |

**Indexes:** `ix_players_team_id`, `ix_players_external_id`, `ix_players_name`

### lineups

A team's lineup for a specific match.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | INTEGER | PK, autoincrement | |
| match_id | INTEGER | FK -> matches.id ON DELETE CASCADE, NOT NULL | |
| team_id | INTEGER | FK -> teams.id ON DELETE CASCADE, NOT NULL | |
| formation | VARCHAR(16) | | e.g. `"4-3-3"` |
| coach | VARCHAR(128) | | Manager / head coach name |
| created_at | TIMESTAMPTZ | NOT NULL, server_default=now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, server_default=now() | |

**Indexes:** `ix_lineups_match_id`, `ix_lineups_team_id`

### lineup_players

Association between a lineup and a player, with positional data. Composite primary key.

| Column | Type | Constraints | Description |
|---|---|---|---|
| lineup_id | INTEGER | PK, FK -> lineups.id ON DELETE CASCADE | |
| player_id | INTEGER | PK, FK -> players.id ON DELETE CASCADE | |
| is_starter | BOOLEAN | NOT NULL, default true | |
| position | VARCHAR(32) | | Pitch position, e.g. `"LW"`, `"CB"` |
| x | FLOAT | | Pitch x-coordinate (0-100) |
| y | FLOAT | | Pitch y-coordinate (0-100) |

### player_stats_snapshots

Periodic snapshot of a player's aggregated statistics.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | INTEGER | PK, autoincrement | |
| player_id | INTEGER | FK -> players.id ON DELETE CASCADE, NOT NULL | |
| season | VARCHAR(32) | NOT NULL | e.g. `"2025/26"` |
| appearances | INTEGER | NOT NULL, default 0 | |
| goals | INTEGER | NOT NULL, default 0 | |
| assists | INTEGER | NOT NULL, default 0 | |
| xg | FLOAT | | Expected goals |
| xa | FLOAT | | Expected assists |
| yellow_cards | INTEGER | NOT NULL, default 0 | |
| red_cards | INTEGER | NOT NULL, default 0 | |
| minutes_played | INTEGER | NOT NULL, default 0 | |
| rating | FLOAT | | 0-10 aggregate rating |
| data_source | VARCHAR(64) | | Provider name |
| snapshot_date | DATE | NOT NULL | |
| created_at | TIMESTAMPTZ | NOT NULL, server_default=now() | |

**Indexes:** `ix_player_stats_snapshots_player_id`, `ix_player_stats_snapshots_season`, `ix_player_stats_snapshots_player_season_date` (composite)

### predictions

A match outcome prediction produced by a model.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | INTEGER | PK, autoincrement | |
| match_id | INTEGER | FK -> matches.id ON DELETE CASCADE, NOT NULL | |
| home_win | FLOAT | NOT NULL | 0-100 probability |
| draw | FLOAT | NOT NULL | 0-100 probability |
| away_win | FLOAT | NOT NULL | 0-100 probability |
| expected_home_goals | FLOAT | NOT NULL | |
| expected_away_goals | FLOAT | NOT NULL | |
| confidence | FLOAT | NOT NULL | 0-1 |
| model_name | VARCHAR(128) | NOT NULL | |
| model_version | VARCHAR(32) | NOT NULL | |
| data_completeness_score | FLOAT | | 0-1 |
| created_at | TIMESTAMPTZ | NOT NULL, server_default=now() | |

**Indexes:** `ix_predictions_match_id`, `ix_predictions_model_name`, `ix_predictions_created_at`

### prediction_inputs

Raw input data captured when a prediction was generated.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | INTEGER | PK, autoincrement | |
| prediction_id | INTEGER | FK -> predictions.id ON DELETE CASCADE, NOT NULL | |
| input_type | VARCHAR(64) | NOT NULL | e.g. `"lineup"`, `"team_stats"`, `"player_ratings"` |
| input_data | JSONB | | Serialized input payload |
| created_at | TIMESTAMPTZ | NOT NULL, server_default=now() | |

**Indexes:** `ix_prediction_inputs_prediction_id`

### scripts

A generated broadcast / commentary script for a match.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | INTEGER | PK, autoincrement | |
| match_id | INTEGER | FK -> matches.id ON DELETE CASCADE, NOT NULL | |
| language | VARCHAR(16) | NOT NULL | `en` / `zh` / `bilingual` |
| style | VARCHAR(32) | | `broadcast` / `short-video` / etc. |
| duration | VARCHAR(16) | | `15s` / `30s` / `1min` / `3min` |
| title | VARCHAR(256) | NOT NULL | |
| content | TEXT | NOT NULL | The script body text |
| grounding_data | JSONB | | Prediction + lineup snapshot used as context |
| provider | VARCHAR(64) | NOT NULL | e.g. `"lineupcast-ai-script"` |
| model | VARCHAR(128) | NOT NULL | e.g. `"GPT-4o@1.0.0"` |
| latency_ms | INTEGER | NOT NULL, default 0 | Generation latency |
| fallback | BOOLEAN | NOT NULL, default false | Whether this was a fallback script |
| created_at | TIMESTAMPTZ | NOT NULL, server_default=now() | |

**Indexes:** `ix_scripts_match_id`, `ix_scripts_language`, `ix_scripts_created_at`

### users

Application users with role-based access control.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | INTEGER | PK, autoincrement | |
| email | VARCHAR(256) | UNIQUE, NOT NULL | Login identifier |
| name | VARCHAR(128) | | Display name |
| role | VARCHAR(32) | NOT NULL, default `'viewer'` | Global role: `owner` / `admin` / `editor` / `operator` / `viewer` |
| created_at | TIMESTAMPTZ | NOT NULL, server_default=now() | |

**Indexes:** `ix_users_email`, `ix_users_role`

### workspaces

Multi-tenant workspaces that group users, API keys, and resources.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | INTEGER | PK, autoincrement | |
| name | VARCHAR(128) | NOT NULL | Display name |
| slug | VARCHAR(64) | UNIQUE, NOT NULL | URL-safe identifier |
| created_at | TIMESTAMPTZ | NOT NULL, server_default=now() | |

**Indexes:** `ix_workspaces_slug`

### workspace_members

Many-to-many association between workspaces and users, with a per-workspace role. Composite primary key.

| Column | Type | Constraints | Description |
|---|---|---|---|
| workspace_id | INTEGER | PK, FK -> workspaces.id ON DELETE CASCADE | |
| user_id | INTEGER | PK, FK -> users.id ON DELETE CASCADE | |
| role | VARCHAR(32) | NOT NULL, default `'viewer'` | Per-workspace role: `owner` / `admin` / `editor` / `operator` / `viewer` |

**Indexes:** `ix_workspace_members_workspace_id`, `ix_workspace_members_user_id`

### api_keys

Workspace-scoped API keys for programmatic access.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | INTEGER | PK, autoincrement | |
| workspace_id | INTEGER | FK -> workspaces.id ON DELETE CASCADE, NOT NULL | |
| name | VARCHAR(128) | NOT NULL | Human-readable label |
| key_hash | VARCHAR(128) | NOT NULL | SHA-256 hash of the raw key |
| masked_key | VARCHAR(32) | NOT NULL | Masked display form, e.g. `"lc_abc...xyz"` |
| scopes | JSONB | | Permission scope, e.g. `{"read": true, "write": false}` |
| last_used_at | TIMESTAMPTZ | | Last request timestamp |
| expires_at | TIMESTAMPTZ | | Expiration timestamp |
| created_at | TIMESTAMPTZ | NOT NULL, server_default=now() | |

**Indexes:** `ix_api_keys_workspace_id`, `ix_api_keys_key_hash`, `ix_api_keys_expires_at`

### audit_logs

Immutable audit trail for security and compliance. Rows should never be updated or deleted by application code.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | INTEGER | PK, autoincrement | |
| user_id | INTEGER | FK -> users.id ON DELETE SET NULL | Nullable to preserve history after user deletion |
| action | VARCHAR(64) | NOT NULL | e.g. `"user.login"`, `"prediction.create"`, `"apikey.rotate"` |
| resource_type | VARCHAR(64) | NOT NULL | e.g. `"user"`, `"prediction"`, `"api_key"` |
| resource_id | VARCHAR(128) | | Primary key of the affected resource |
| details | JSONB | | Arbitrary context payload |
| created_at | TIMESTAMPTZ | NOT NULL, server_default=now() | |

**Indexes:** `ix_audit_logs_user_id`, `ix_audit_logs_action`, `ix_audit_logs_resource_type`, `ix_audit_logs_created_at`

---

## Entity Relationships

```
providers  1──N  provider_runs
teams      1──N  players
teams      1──N  lineups           (via team_id)
teams      1──N  matches           (via home_team_id, away_team_id)
matches    1──N  lineups
matches    1──N  predictions
matches    1──N  scripts
lineups    1──N  lineup_players    (composite PK: lineup_id + player_id)
players    1──N  lineup_players
players    1──N  player_stats_snapshots
predictions 1──N prediction_inputs
workspaces 1──N  workspace_members
users      1──N  workspace_members
workspaces 1──N  api_keys
users      1──N  audit_logs
```

## Cascade Rules

| Relationship | On Delete |
|---|---|
| providers -> provider_runs | CASCADE |
| teams -> players | SET NULL |
| teams -> lineups | CASCADE |
| matches -> lineups | CASCADE |
| matches -> predictions | CASCADE |
| matches -> scripts | CASCADE |
| lineups -> lineup_players | CASCADE |
| players -> lineup_players | CASCADE |
| players -> player_stats_snapshots | CASCADE |
| predictions -> prediction_inputs | CASCADE |
| workspaces -> workspace_members | CASCADE |
| users -> workspace_members | CASCADE |
| workspaces -> api_keys | CASCADE |
| users -> audit_logs | SET NULL |

## JSONB vs JSON

- **PostgreSQL (production):** All `JSONType` columns map to `JSONB` with native binary storage and indexing support.
- **SQLite (development):** `JSONType` columns store JSON as `TEXT`. The `JSON1` extension provides basic query functions.
