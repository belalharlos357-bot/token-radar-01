# token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/belalharlos357-bot/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/belalharlos357-bot/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar ranks every pre-token protocol in DefiLlama's sealed snapshot by implied token value — a value curve fitted on the tokens that already trade, times token odds fitted on the peers' own record — and gives each one a ten-step farm plan with costs and times, priced at four deposits under the same two bars. The value curve is ln(mcap) = 16.371 + 0.394 × ln(TVL / $100M), fitted on 92 priced comps and tested held out four ways (leave-one-out miss ×3.34, walk-forward ×2.11, leave-a-category-out ×3.73, leave-a-chain-out ×3.34, against ×4.68 / ×4.52 for a flat multiple); token odds are a logistic on age, size, chain count and 7-day growth × size (Brier 0.218 5-fold, 0.246 walk-forward, AUC 0.72; leave-a-category-out 0.222, leave-a-chain-out 0.218). The category token rate is dropped on purpose, not by the tests — it is a marginal, era-confounded average, and keeping it would buy 0.007 on the mixed-era 5-fold Brier and nothing on the forward-looking walk-forward, while letting one feature decide the board's top. Every term is kept only if it improves the walk-forward test by more than the margin without making the other test worse — the rejected ones are listed in the dashboard, not used. The default deposit is a flat $5,000; 41 rows farm at the default, 80 at some tier, under the same 4% T-bill and $25-an-hour bars. A static dashboard (ranked board, live-token comparison, model explainer) renders it with no network.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input path/to/snapshot.json
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=wh5aaqez&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
