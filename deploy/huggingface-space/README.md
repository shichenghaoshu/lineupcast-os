---
title: LineupCast OS
colorFrom: green
colorTo: blue
sdk: docker
app_port: 7860
---

# LineupCast OS Hugging Face Space

This Docker Space exposes a small health-checked service for LineupCast OS deployment wiring.

## Endpoints

- `GET /healthz` - liveness check.
- `GET /readyz` - readiness and safety configuration check.

## Required Port

The service listens on port `7860`.

## Safety Statement

Models calculate. AI narrates. For commentary assistance, not betting advice.
