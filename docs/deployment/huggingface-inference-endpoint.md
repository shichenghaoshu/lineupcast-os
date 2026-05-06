# Hugging Face Inference Endpoint Integration

Hugging Face Inference Endpoints can provide the narration model while LineupCast OS keeps probability calculation inside the algorithm layer.

## Environment

```bash
LLM_PROVIDER=huggingface-endpoint
HUGGINGFACE_ENDPOINT_URL=https://your-endpoint.endpoints.huggingface.cloud
HUGGINGFACE_ENDPOINT_TOKEN=hf_xxx
HUGGINGFACE_MODEL_ID=your-org/your-model
```

## Integration Pattern

1. Calculate match probabilities, scorer rankings, and card risk locally.
2. Build a grounded prompt from those model outputs.
3. Send only the required match context to the endpoint.
4. Validate the generated commentary.
5. Attach the required disclaimer before returning the response.

## Safety

- Do not let the endpoint recalculate or overwrite probabilities.
- Do not request betting recommendations.
- Reject output that adds unsupported injuries, lineups, odds, or claims.

Models calculate. AI narrates. For commentary assistance, not betting advice.
