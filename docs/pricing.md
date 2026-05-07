# Pricing Tiers

> For commentary assistance, not betting advice.

LineupCast OS offers three tiers: Free, Pro, and Enterprise. The open-source core is always free. Paid tiers add real data providers, higher limits, and production features.

---

## Tier Definitions

### Free Tier

**For:** Individual users, students, hobbyists, and evaluation.

**Includes:**

- Mock data provider for demo and learning
- CSV import for lineups, player stats, and match history
- Dixon-Coles prediction model with full algorithm transparency
- AI script generation (limited to 50 scripts/month)
- Data completeness scoring
- Basic provider health monitoring
- Single-user local deployment
- Community support via GitHub Issues

**Limits:**

| Resource | Limit |
|----------|-------|
| Predictions per month | 100 |
| Script generations per month | 50 |
| CSV import rows per month | 1,000 |
| Concurrent API requests | 5 |
| Data retention | 30 days |
| Workspaces | 1 |
| Users | 1 |

**Data Sources:**

- Mock/demo data (bundled)
- CSV import (user-supplied)
- OpenFootball (community data)

---

### Pro Tier

**For:** Broadcast teams, content creators, small analytics groups.

**Includes everything in Free, plus:**

- Real provider integration (football-data.org, FBref)
- Unlimited predictions
- Unlimited script generations
- LLM narration with multiple provider options (OpenAI-compatible, Hugging Face)
- Prediction registry with full provenance
- Provider health monitoring with alerts
- Up to 5 workspaces
- Up to 10 users per workspace
- Email support (48-hour response)

**Limits:**

| Resource | Limit |
|----------|-------|
| Predictions per month | Unlimited |
| Script generations per month | Unlimited |
| CSV import rows per month | 50,000 |
| Concurrent API requests | 25 |
| Data retention | 1 year |
| Workspaces | 5 |
| Users per workspace | 10 |
| API rate limit | 100 requests/minute |

**Data Sources:**

- All Free tier sources
- football-data.org (fixtures, standings, match detail)
- FBref (player stats, xG data)
- Custom CSV imports

---

### Enterprise Tier

**For:** Broadcast networks, sports media companies, large organizations.

**Includes everything in Pro, plus:**

- Custom provider integration (bring your own data sources)
- Dedicated API access with SLA
- Custom LLM endpoint configuration
- Workspace isolation with RBAC
- Audit logging with 1-year retention
- Custom calibration reports by league and season
- Priority email support (4-hour response)
- Dedicated support channel (Slack/Teams)
- On-premise deployment option
- Custom branding (white-label overlays)

**Limits:**

| Resource | Limit |
|----------|-------|
| Predictions per month | Unlimited |
| Script generations per month | Unlimited |
| CSV import rows per month | Unlimited |
| Concurrent API requests | Custom |
| Data retention | Custom |
| Workspaces | Unlimited |
| Users per workspace | Unlimited |
| API rate limit | Custom |

**Data Sources:**

- All Pro tier sources
- Custom provider adapters
- StatBomb (with valid license)
- Any proprietary data source via provider contract

---

## Feature Comparison

| Feature | Free | Pro | Enterprise |
|---------|------|-----|------------|
| **Data** | | | |
| Mock / demo data | Yes | Yes | Yes |
| CSV import | Yes (1K rows/mo) | Yes (50K rows/mo) | Yes (unlimited) |
| football-data.org | -- | Yes | Yes |
| FBref | -- | Yes | Yes |
| Custom providers | -- | -- | Yes |
| **Prediction** | | | |
| Dixon-Coles model | Yes | Yes | Yes |
| xG scorer ranking | Yes | Yes | Yes |
| Card risk estimation | Yes | Yes | Yes |
| Data completeness scoring | Yes | Yes | Yes |
| Degraded mode | Yes | Yes | Yes |
| Prediction registry | -- | Yes | Yes |
| Calibration reports | -- | -- | Yes (by league/season) |
| **AI Narration** | | | |
| Script generation | Yes (50/mo) | Yes (unlimited) | Yes (unlimited) |
| Bilingual output (EN/ZH) | Yes | Yes | Yes |
| OpenAI-compatible endpoint | -- | Yes | Yes |
| Hugging Face endpoint | -- | Yes | Yes |
| Custom LLM endpoint | -- | -- | Yes |
| **Operations** | | | |
| Provider health monitoring | Basic | Full + alerts | Full + alerts + custom |
| Audit logging | -- | -- | Yes (1-year retention) |
| API rate limiting | 5 concurrent | 100/min | Custom |
| Data retention | 30 days | 1 year | Custom |
| **Collaboration** | | | |
| Workspaces | 1 | 5 | Unlimited |
| Users per workspace | 1 | 10 | Unlimited |
| RBAC roles | -- | -- | Yes |
| **Support** | | | |
| Community (GitHub Issues) | Yes | Yes | Yes |
| Email support | -- | 48-hour | 4-hour |
| Dedicated channel | -- | -- | Yes |
| **Deployment** | | | |
| Local Docker | Yes | Yes | Yes |
| Cloud hosting | -- | Yes | Yes |
| On-premise | -- | -- | Yes |
| White-label | -- | -- | Yes |

---

## Self-Hosting (Open Source)

The open-source LineupCast OS codebase is free to use under the MIT license. Self-hosting gives you:

- Full source code access
- All core algorithms (Dixon-Coles, xG scorer, card risk)
- Mock data provider
- CSV import
- AI script generation (bring your own LLM key)
- No usage limits

Self-hosted deployments do not include:

- Real data provider API keys (you supply your own)
- Managed infrastructure
- SLA or support guarantees
- Billing or usage tracking

---

## FAQ

**Q: Can I use the free tier in production?**
A: Yes, but with limits. The free tier is designed for evaluation and personal use. Production broadcast workflows should use Pro or Enterprise for unlimited predictions and real data providers.

**Q: Can I switch tiers without losing data?**
A: Yes. Upgrading preserves all your data, predictions, and scripts. Downgrading may restrict access to features but does not delete data.

**Q: Do I need a paid tier to use the prediction model?**
A: No. The prediction model is fully available on the free tier with mock data and CSV imports.

**Q: Can I bring my own data provider?**
A: On the Enterprise tier, yes. Custom providers implement the `FootballDataProvider` contract. See [provider-contract.md](provider-contract.md).

**Q: Is there a discount for annual billing?**
A: Annual billing details will be published when V1.0 launches.

---

## Disclaimer

LineupCast OS is an educational and analytical tool for pre-match commentary preparation. It is not a betting service. Predictions are probabilistic estimates based on historical data -- they are not guarantees. Always verify information independently.
