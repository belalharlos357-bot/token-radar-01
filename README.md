# token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/belalharlos357-bot/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/belalharlos357-bot/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar ranks every pre-token protocol in DefiLlama's sealed snapshot by implied token value — a value curve fitted on the tokens that already trade, times token odds fitted on the peers' own record — and gives each one a ten-step farm plan with costs and times, priced at four deposits under the same two bars. The value curve is ln(mcap) = 16.611 + 0.381 × ln(TVL / $100M) − 0.448 × ln(chains, capped at 3), fitted on 92 priced comps and tested held out four ways (leave-one-out miss ×2.93, walk-forward ×2.08, leave-a-category-out ×2.88, leave-a-chain-out ×3.33, against ×4.68 / ×4.52 for a flat multiple); token odds are a ridge logistic (λ=3) on age, age², size, chain count (capped at 3) and 7-day growth × size (Brier 0.211 5-fold, 0.241 walk-forward, AUC 0.74; leave-a-category-out 0.213, leave-a-chain-out 0.212). The age² term is new in radar-9: the launch-odds curve in age is not log-linear, and the squared term improves all five held-out odds tests at once. The category token rate is dropped on purpose, not by the tests — it is a marginal, era-confounded average, and keeping it would buy 0.007 on the mixed-era 5-fold Brier and nothing on the forward-looking walk-forward, while letting one feature decide the board's top. Every term is kept only if it improves the walk-forward test by more than the margin without making the other test worse — the rejected ones are listed in the dashboard, not used. The default deposit is a flat $5,000; 44 rows farm at the default, 83 at some tier, under the same 4% T-bill and $25-an-hour bars. The detail page now names the smallest deposit that clears both bars at the chosen drop share and horizon ($3,318 for marginfi Lending at 7% / 12 weeks), and the model tab shows the farm matrix by deposit and explains why the top ranks are wide. A static dashboard (ranked board, live-token comparison, model explainer) renders it with no network.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input path/to/snapshot.json
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=wh5aaqez&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
