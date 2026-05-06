# API Reference

The API is a FastAPI service. Local default base URL:

```text
http://localhost:8000
```

## Health

### `GET /health`

Returns service status.

```json
{
  "status": "ok",
  "version": "0.1.0"
}
```

## Match Demo

### `GET /api/matches/demo`

Returns the demo match summary used by the web dashboard.

## Teams

### `GET /api/teams/{team_id}`

Returns team details for a known team id.

## Players

### `GET /api/players/{player_id}`

Returns player details for a known player id.

## Lineups

### `GET /api/matches/{match_id}/lineups`

Returns home and away projected lineup data for a match.

## Prediction

### `GET /api/matches/{match_id}/prediction`

Returns match model output:

- Home, draw, and away probabilities.
- Expected goals.
- Goal scorer probabilities.
- Card-risk notes.
- Model explanations.

## Script Generation

### `POST /api/matches/{match_id}/script`

Generates a commentary script from match data and model outputs.

The generated script must preserve the project safety posture:

```text
Models calculate. AI narrates. For commentary assistance, not betting advice.
```

## Overlay

### `GET /api/matches/{match_id}/overlay`

Returns layout metadata for broadcast overlays.

## Providers

### `GET /api/providers`

Returns configured provider status metadata.
