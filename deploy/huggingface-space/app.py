"""Minimal Hugging Face Space service for LineupCast OS."""

import os
from typing import Any

from fastapi import FastAPI


app = FastAPI(
    title="LineupCast OS Space",
    version="0.1.0",
    description="Health-checked deployment wrapper for football commentary assistance.",
)


SAFETY_STATEMENT = (
    "Models calculate. AI narrates. For commentary assistance, not betting advice."
)


@app.get("/")
def root() -> dict[str, str]:
    return {
        "service": "lineupcast-os-space",
        "status": "ok",
        "disclaimer": SAFETY_STATEMENT,
    }


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/readyz")
def readyz() -> dict[str, Any]:
    return {
        "status": "ready",
        "appEnv": os.getenv("APP_ENV", "huggingface-space"),
        "llmProvider": os.getenv("LLM_PROVIDER", "none"),
        "aiNarrationEnabled": os.getenv("ENABLE_AI_NARRATION", "true").lower()
        == "true",
        "bettingAdviceEnabled": os.getenv("ENABLE_BETTING_ADVICE", "false").lower()
        == "true",
        "requireDisclaimer": os.getenv("REQUIRE_DISCLAIMER", "true").lower()
        == "true",
        "disclaimer": SAFETY_STATEMENT,
    }
