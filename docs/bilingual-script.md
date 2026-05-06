# Bilingual Script Guide

The bilingual script layer turns calculated model outputs into broadcast-ready English and Chinese commentary.

## Principles

- Keep the numeric facts unchanged.
- Write for presenters, not data scientists.
- Separate model output from AI wording.
- Avoid betting language.
- Include the safety statement when scripts are exported or shown publicly.

Models calculate. AI narrates. For commentary assistance, not betting advice.

## Recommended Structure

| Section | English | Chinese |
| --- | --- | --- |
| Opening | Match setup and context. | 比赛背景和看点。 |
| Model View | Probabilities and xG. | 胜平负概率和预期进球。 |
| Key Player | Scorer or creator focus. | 重点球员和进攻威胁。 |
| Risk Note | Card, lineup, or uncertainty note. | 牌面风险、阵容不确定性。 |
| Closing | Short presenter handoff. | 主持人口播收束。 |

## Style

- English: concise, broadcast-friendly, no inflated certainty.
- Chinese: natural sports commentary tone, avoid literal machine translation.
- Use rounded probabilities unless calibration allows precision.
- Prefer "projects", "leans", "suggests", "预计", "倾向", and "模型显示".

## Example Template

```text
EN:
The model gives {homeTeam} a {homeWin}% home-win chance, with {expectedHomeGoals} expected goals. The main reason is {driver}.

ZH:
模型给到{homeTeam}{homeWin}%的主胜概率，预期进球为{expectedHomeGoals}。核心原因是{driverZh}。

Disclaimer:
Models calculate. AI narrates. For commentary assistance, not betting advice.
```
