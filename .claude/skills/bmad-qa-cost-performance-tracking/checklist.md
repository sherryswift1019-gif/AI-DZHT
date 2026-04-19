# CT Cost & Performance Tracking — Validation Checklist

## Data Collection

- [ ] Duration metrics captured
- [ ] Token usage recorded (if applicable)
- [ ] API call count recorded
- [ ] Cost estimated

## Persistence

- [ ] Metrics saved with unique run_id
- [ ] Historical metrics capped at 20
- [ ] Schema version included

## Analysis

- [ ] Rolling 5-run average calculated
- [ ] Anomalies detected against thresholds
- [ ] Root cause identified for anomalies (which suite/test)

## Report

- [ ] Summary table with current vs average
- [ ] Anomalies highlighted with cause
- [ ] Per-suite breakdown included
- [ ] Optimization suggestions provided for anomalies

---

**Quality Bar**: The report should tell a team lead whether test costs are stable or growing, and what to do about it, in under 1 minute.
