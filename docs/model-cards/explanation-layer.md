# Model Card: Deterministic Explanation Layer

> Based on [Model Cards for Model Reporting (Mitchell et al., 2019)](https://arxiv.org/abs/1810.03993)

## Model Details

- **Name:** explanation-layer
- **Version:** 1.0.0
- **Type:** Rule-based template system
- **Owner:** LineupCast OS community
- **License:** MIT

## Purpose

Converts raw model outputs into human-readable reasoning chains **without LLM involvement**. Every explanation is deterministic: the same input always produces the same text.

## Why Deterministic?

LLMs can generate fluent explanations, but:
1. They may hallucinate feature values or importance
2. Different runs produce different explanations for the same input
3. They cannot be audited or tested for correctness

The explanation layer uses:
- **Per-model feature importance rankings** (hardcoded, derived from literature)
- **Per-model limitation lists** (curated from paper discussion sections)
- **Inline explanation strings** from each model's output

## Output

- `modelCard` — model name and version
- `summary` — concatenated explanation strings from the model
- `featureImportance` — ordered list of most influential features
- `limitations` — known caveats and weaknesses
- `references` — academic papers backing the approach

## Limitations

- Explanations are template-based, not conversational
- Feature importance rankings are population-level, not instance-level
- Does not explain why a specific input led to a specific output (no counterfactuals)
