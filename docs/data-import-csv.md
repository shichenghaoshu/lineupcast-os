# CSV Data Import Guide

LineupCast OS supports bulk data ingestion via CSV uploads. This document covers the three supported import types, their schemas, validation rules, and example payloads.

All CSV import endpoints require admin authentication. Include the admin API key in the request header:

```text
X-Admin-Key: <your-admin-key>
```

---

## Table of Contents

1. [Lineup CSV](#lineup-csv)
2. [Player Stats CSV](#player-stats-csv)
3. [Match History CSV](#match-history-csv)
4. [General Notes](#general-notes)

---

## Lineup CSV

Import starting lineups and bench players for a specific match. Each row represents one player assignment. The CSV must contain exactly 11 starters per team and optionally up to 12 substitutes.

### Endpoint

```text
POST /api/imports/lineups
Content-Type: multipart/form-data
```

### Required Headers

| Header | Type | Required | Description |
|--------|------|----------|-------------|
| match_id | string | Yes | Match identifier. Must match an existing match or the system creates one. |
| team_id | string | Yes | Team slug, e.g. `manchester-red`. |
| team_name | string | Yes | Full display name, e.g. `Manchester Red`. |
| formation | string | Yes | Formation string, e.g. `4-2-3-1`, `4-3-3`, `3-5-2`. |
| player_id | string | No | Unique player identifier. Auto-generated if omitted. |
| player_name | string | Yes | Player full name, e.g. `V. Finish`. |
| position | string | Yes | Position code: `GK`, `CB`, `LB`, `RB`, `DM`, `CM`, `AM`, `LW`, `RW`, `ST`. |
| role | string | Yes | Descriptive role, e.g. `Goalkeeper`, `Centre Back`, `Defensive Midfielder`. |
| shirt_number | integer | Yes | Shirt number, 1-99. |
| is_starter | boolean | Yes | `true` for starting XI, `false` for substitutes. |
| age | integer | Yes | Player age, 15-45. |
| nationality | string | Yes | Country name, e.g. `England`, `Brazil`. |
| recent_rating | float | Yes | Recent match rating, 0.0-10.0. |
| xg_last_5 | float | Yes | Expected goals over last 5 matches, 0.0-10.0. |
| shots_last_5 | integer | Yes | Total shots over last 5 matches, 0-100. |
| assists_last_5 | integer | Yes | Total assists over last 5 matches, 0-50. |
| fouls_per_90 | float | Yes | Fouls committed per 90 minutes, 0.0-10.0. |
| yellow_cards_last_10 | integer | Yes | Yellow cards in last 10 matches, 0-10. |
| vaep_attack | float | Yes | VAEP attacking contribution score, 0.0-1.0. |
| vaep_defense | float | Yes | VAEP defensive contribution score, 0.0-1.0. |
| commentary_note | string | No | Free-text scouting note for script generation. |
| pitch_x | float | Yes | Pitch x-coordinate, 0-100. Left (0) to right (100) from home team perspective. |
| pitch_y | float | Yes | Pitch y-coordinate, 0-100. Bottom (0) to top (100). |

### Example CSV

```csv
match_id,team_id,team_name,formation,player_id,player_name,position,role,shirt_number,is_starter,age,nationality,recent_rating,xg_last_5,shots_last_5,assists_last_5,fouls_per_90,yellow_cards_last_10,vaep_attack,vaep_defense,commentary_note,pitch_x,pitch_y
demo-match-001,manchester-red,Manchester Red,4-2-3-1,manchester-red-keeper,A. Keeper,GK,Goalkeeper,1,true,28,England,7.1,0.0,0,0,0.3,0,0.01,0.82,Reliable shot-stopper - commands the box well on set pieces,5,50
demo-match-001,manchester-red,Manchester Red,4-2-3-1,manchester-red-wing,L. Wing,RB,Right Back,2,true,25,Portugal,7.3,0.1,2,2,1.2,2,0.35,0.68,Overlapping runs are a key outlet - watch for early crosses,25,85
demo-match-001,manchester-red,Manchester Red,4-2-3-1,manchester-red-stone,M. Stone,CB,Centre Back,4,true,27,Netherlands,6.9,0.1,1,0,1.1,3,0.08,0.87,Ball-playing defender - look for diagonal switches to the wings,20,40
demo-match-001,manchester-red,Manchester Red,4-2-3-1,manchester-red-press,C. Press,DM,Defensive Midfielder,7,true,24,Brazil,7.5,0.4,6,2,1.8,4,0.41,0.55,Box-to-box energy - high pressing trigger - needs to watch fouls,45,35
demo-match-001,manchester-red,Manchester Red,4-2-3-1,manchester-red-finish,V. Finish,ST,Striker,9,true,26,Uruguay,8.1,1.2,14,0,0.8,1,0.85,0.08,Clinical finisher - top scorer candidate - thrives on crosses,85,50
```

### Validation Rules

1. **Exactly 11 starters** per team per match. The API rejects files with fewer or more than 11 `is_starter=true` rows for any single `team_id`.
2. **Formation consistency** -- the formation string must match the count of outfield positions among starters (e.g. `4-2-3-1` means 1 GK + 4 defenders + 2 DM/CM + 3 AM/wingers + 1 striker = 11).
3. **Unique shirt numbers** within each team. Duplicate numbers cause a validation error.
4. **Position codes** must be from the allowed set: `GK`, `CB`, `LB`, `RB`, `DM`, `CM`, `AM`, `LW`, `RW`, `ST`.
5. **Pitch coordinates** must be within 0-100. Goalkeepers should be near their own goal line.
6. **Numeric ranges** -- ratings 0.0-10.0, VAEP scores 0.0-1.0, age 15-45.
7. **Two teams required** per match -- the file must contain rows for both the home and away team identified by distinct `team_id` values.

### Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `VALIDATION_STARTERS_COUNT` | Team does not have exactly 11 starters | Check `is_starter` column; count rows where value is `true` for each team |
| `DUPLICATE_SHIRT_NUMBER` | Two players on the same team share a number | Assign unique numbers 1-99 per team |
| `INVALID_POSITION` | Position code not in the allowed set | Use one of: GK, CB, LB, RB, DM, CM, AM, LW, RW, ST |
| `COORDINATE_OUT_OF_RANGE` | pitch_x or pitch_y outside 0-100 | Clamp values to the 0-100 range |
| `RATING_OUT_OF_RANGE` | recent_rating exceeds 10.0 or is negative | Use a 0.0-10.0 scale |
| `FORMATION_MISMATCH` | Player position counts do not match formation | Ensure position counts align with the declared formation string |

### curl Example

```bash
curl -X POST http://localhost:8000/api/imports/lineups \
  -H "X-Admin-Key: your-admin-key" \
  -F "file=@lineup.csv"
```

---

## Player Stats CSV

Bulk-import or update player statistics. Each row represents one player's aggregated stats over a recent window. Use this to refresh player data before generating predictions without importing a full lineup.

### Endpoint

```text
POST /api/imports/players
Content-Type: multipart/form-data
```

### Required Headers

| Header | Type | Required | Description |
|--------|------|----------|-------------|
| player_id | string | Yes | Unique player identifier. Updates existing record if it already exists. |
| team_id | string | Yes | Team slug the player belongs to. |
| player_name | string | Yes | Full display name. |
| position | string | Yes | Primary position code: `GK`, `CB`, `LB`, `RB`, `DM`, `CM`, `AM`, `LW`, `RW`, `ST`. |
| role | string | Yes | Descriptive role, e.g. `Striker`, `Central Midfielder`. |
| shirt_number | integer | Yes | Current shirt number, 1-99. |
| age | integer | Yes | Current age, 15-45. |
| nationality | string | Yes | Country name. |
| recent_rating | float | Yes | Most recent match rating, 0.0-10.0. |
| xg_last_5 | float | Yes | Cumulative xG over last 5 appearances, 0.0-10.0. |
| shots_last_5 | integer | Yes | Total shots over last 5 matches, 0-100. |
| assists_last_5 | integer | Yes | Total assists over last 5 matches, 0-50. |
| fouls_per_90 | float | Yes | Fouls committed per 90 minutes, 0.0-10.0. |
| yellow_cards_last_10 | integer | Yes | Yellow cards in last 10 matches, 0-10. |
| vaep_attack | float | Yes | VAEP attacking contribution score, 0.0-1.0. |
| vaep_defense | float | Yes | VAEP defensive contribution score, 0.0-1.0. |
| commentary_note | string | No | Free-text scouting note. |

### Example CSV

```csv
player_id,team_id,player_name,position,role,shirt_number,age,nationality,recent_rating,xg_last_5,shots_last_5,assists_last_5,fouls_per_90,yellow_cards_last_10,vaep_attack,vaep_defense,commentary_note
manchester-red-finish,manchester-red,V. Finish,ST,Striker,9,26,Uruguay,8.1,1.2,14,0,0.8,1,0.85,0.08,Clinical finisher - top scorer candidate - thrives on crosses
manchester-red-spark,manchester-red,J. Spark,RW,Right Winger,8,23,Senegal,7.8,0.8,10,1,0.7,1,0.67,0.18,Electric pace on the counter - favourite to score first
manchester-red-vision,manchester-red,B. Vision,AM,Attacking Midfielder,10,27,Argentina,7.9,0.5,7,4,0.6,0,0.72,0.25,Creative hub - unlocks defences with through balls and set pieces
shanghai-harbor-marksman,shanghai-harbor,T. Marksman,ST,Striker,9,28,Italy,7.2,0.9,12,0,0.9,1,0.72,0.06,Poacher instinct - excellent movement in the box
shanghai-harbor-counter,shanghai-harbor,H. Counter,RW,Right Winger,7,23,Nigeria,7.4,0.7,9,1,0.6,1,0.60,0.12,Lightning quick on the break - primary counter-attack threat
```

### Validation Rules

1. **player_id must be unique** within the upload. Duplicate IDs in the same file produce an error.
2. **team_id must be valid** -- either an existing team slug or a new team that will be created implicitly.
3. **Position codes** must be from the allowed set.
4. **Numeric ranges** match the Lineup CSV rules.
5. **Upsert behaviour** -- if `player_id` already exists in the database, the row updates the existing record. If it does not exist, a new player record is created.
6. **Maximum file size** -- 10 MB. Files exceeding this limit are rejected before parsing.

### Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `DUPLICATE_PLAYER_ID` | Same player_id appears twice in the file | Deduplicate rows before uploading |
| `INVALID_POSITION` | Position code not in allowed set | Use one of: GK, CB, LB, RB, DM, CM, AM, LW, RW, ST |
| `VALUE_OUT_OF_RANGE` | A numeric field exceeds its bounds | Check rating (0-10), VAEP (0-1), age (15-45), etc. |
| `MISSING_REQUIRED_FIELD` | A required column has an empty value | Ensure every required cell is populated |
| `FILE_TOO_LARGE` | CSV exceeds 10 MB | Split into smaller batches |

### curl Example

```bash
curl -X POST http://localhost:8000/api/imports/players \
  -H "X-Admin-Key: your-admin-key" \
  -F "file=@player_stats.csv"
```

---

## Match History CSV

Import historical match results for training and backtesting prediction models. Each row is one completed match with final score and metadata. The system uses these records for Dixon-Coles calibration, time-weighted goal analysis, and model evaluation.

### Endpoint

```text
POST /api/imports/matches
Content-Type: multipart/form-data
```

### Required Headers

| Header | Type | Required | Description |
|--------|------|----------|-------------|
| match_id | string | Yes | Unique match identifier, e.g. `prem-2025-ars-che-01`. |
| competition | string | Yes | Competition or league name, e.g. `Premier League`. |
| season | string | Yes | Season string, e.g. `2024-25`, `2025`. |
| matchday | integer | Yes | Round or matchday number, 1-50. |
| kickoff | string | Yes | ISO 8601 datetime, e.g. `2025-04-12T15:00:00Z`. |
| home_team_id | string | Yes | Home team slug. |
| home_team_name | string | Yes | Home team full name. |
| away_team_id | string | Yes | Away team slug. |
| away_team_name | string | Yes | Away team full name. |
| home_goals | integer | Yes | Home team final score, 0-20. |
| away_goals | integer | Yes | Away team final score, 0-20. |
| status | string | Yes | Match status: `finished`, `postponed`, `cancelled`. |
| referee | string | No | Referee name. Used for card-risk model features. |
| venue | string | No | Stadium name. |
| attendance | integer | No | Reported attendance, 0-120000. |
| home_xg | float | No | Home team expected goals (if available), 0.0-10.0. |
| away_xg | float | No | Away team expected goals (if available), 0.0-10.0. |

### Example CSV

```csv
match_id,competition,season,matchday,kickoff,home_team_id,home_team_name,away_team_id,away_team_name,home_goals,away_goals,status,referee,venue,attendance,home_xg,away_xg
prem-2025-ars-che-01,Premier League,2024-25,32,2025-04-12T15:00:00Z,arsenal,Arsenal,chelsea,Chelsea,2,1,finished,Michael Oliver,Emirates Stadium,60260,2.3,0.9
prem-2025-liv-mci-01,Premier League,2024-25,32,2025-04-12T17:30:00Z,liverpool,Liverpool,manchester-city,Manchester City,1,1,finished,Anthony Taylor,Anfield,54074,1.1,1.4
prem-2025-mun-tot-01,Premier League,2024-25,33,2025-04-19T15:00:00Z,manchester-united,Manchester United,tottenham,Tottenham,0,3,finished,Stuart Attwell,Old Trafford,74310,0.8,2.6
laliga-2025-rma-bar-01,La Liga,2024-25,30,2025-03-23T21:00:00Z,real-madrid,Real Madrid,barcelona,Barcelona,3,2,finished,Juan Martinez,Santiago Bernabeu,78192,2.1,1.8
bundesliga-2025-bvb-fcb-01,Bundesliga,2024-25,28,2025-03-30T18:30:00Z,borussia-dortmund,Borussia Dortmund,bayern-munich,Bayern Munich,1,4,finished,Felix Brych,Signal Iduna Park,81365,0.9,3.1
```

### Validation Rules

1. **match_id must be unique** within the upload and across the database. Duplicate match IDs are rejected.
2. **kickoff must be valid ISO 8601** with timezone offset or Z suffix.
3. **Score values** must be non-negative integers, 0-20. Scores above 20 trigger a warning but are not rejected.
4. **status values** restricted to `finished`, `postponed`, `cancelled`. Only `finished` matches are used for model training.
5. **Season format** -- accepted formats: `YYYY-YY` (e.g. `2024-25`), `YYYY` (e.g. `2025`), or `YYYY/YYYY` (e.g. `2024/2025`).
6. **Optional xG fields** -- if provided, must be non-negative floats. These are used for model calibration when available.
7. **Team IDs** -- if `home_team_id` or `away_team_id` does not exist, the system creates a minimal team record using the corresponding `*_team_name` field.

### Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `DUPLICATE_MATCH_ID` | match_id already exists in the database | Use a unique ID or check existing records first |
| `INVALID_DATETIME` | kickoff is not valid ISO 8601 | Use format `YYYY-MM-DDTHH:MM:SSZ` |
| `INVALID_STATUS` | status not in the allowed set | Use `finished`, `postponed`, or `cancelled` |
| `NEGATIVE_SCORE` | home_goals or away_goals is negative | Scores must be 0 or greater |
| `INVALID_SEASON_FORMAT` | Season string not recognised | Use `YYYY-YY`, `YYYY`, or `YYYY/YYYY` |
| `XG_OUT_OF_RANGE` | home_xg or away_xg exceeds bounds | xG values must be 0.0-10.0 |

### curl Example

```bash
curl -X POST http://localhost:8000/api/imports/matches \
  -H "X-Admin-Key: your-admin-key" \
  -F "file=@match_history.csv"
```

---

## General Notes

### File Encoding

All CSV files must be **UTF-8 encoded**. Files with BOM (byte order mark) are accepted. Other encodings (Latin-1, Windows-1252) will be rejected with `INVALID_ENCODING`.

### Quoting Rules

- Fields containing commas, newlines, or double quotes must be wrapped in double quotes.
- Double quotes within a quoted field must be escaped by doubling them (`""`).
- The system follows RFC 4180 CSV format.

### Batch Size Limits

| Import Type | Max Rows | Max File Size |
|-------------|----------|---------------|
| Lineup CSV | 50 rows (25 per team) | 1 MB |
| Player Stats CSV | 1,000 rows | 10 MB |
| Match History CSV | 5,000 rows | 20 MB |

### Error Response Format

All import endpoints return errors in a consistent JSON structure:

```json
{
  "detail": "Validation failed",
  "errors": [
    {
      "row": 3,
      "field": "position",
      "value": "XX",
      "message": "Invalid position code. Allowed: GK, CB, LB, RB, DM, CM, AM, LW, RW, ST"
    }
  ],
  "imported": 0,
  "total": 5
}
```

### Partial Imports

By default, the entire file is rejected if any row fails validation. To allow partial imports where valid rows are accepted and invalid rows are skipped, add the query parameter:

```text
POST /api/imports/lineups?allow_partial=true
```

The response will include both the count of successfully imported rows and a list of errors for the skipped rows.

### Checking Import Status

For large imports, the API returns a job ID that can be polled:

```bash
# Response from a large import
{
  "jobId": "import-20260506-abc123",
  "status": "processing"
}

# Poll for completion
curl http://localhost:8000/api/imports/jobs/import-20260506-abc123 \
  -H "X-Admin-Key: your-admin-key"
```
