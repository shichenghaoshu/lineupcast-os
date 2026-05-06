# OpenAI-Compatible Endpoint Integration

LineupCast OS can use any OpenAI-compatible chat completion endpoint for the narration layer. This includes hosted gateways and self-hosted models that expose the same API style.

## Configuration

```bash
LLM_PROVIDER=openai-compatible
OPENAI_BASE_URL=https://api.example.com/v1
OPENAI_API_KEY=your_key
OPENAI_MODEL=your-model-name
```

## Responsibilities

| Layer | Responsibility |
| --- | --- |
| Algorithm layer | Calculate probabilities, ranks, confidence, and reason codes. |
| AI narration layer | Turn supplied facts into bilingual scripts and presenter notes. |
| Safety layer | Enforce disclaimers and remove betting-advice language. |

## Prompt Contract

Prompts should include:

- System instruction that the model is a commentary assistant.
- Explicit prohibition on betting advice.
- Match and team facts from trusted data providers.
- Numeric model outputs.
- Output language and format.
- Required disclaimer.

## Output Contract

The endpoint should return:

- `headline`
- `key_points`
- `bilingual_script`
- `risk_notes`
- `disclaimer`

If the provider cannot return structured JSON reliably, parse plain text conservatively and show a validation warning in the API response.
