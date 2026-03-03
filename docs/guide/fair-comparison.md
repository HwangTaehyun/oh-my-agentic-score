# Fair Comparison

Short test sessions and trivial conversations can skew aggregate scores. OMAS includes a fair comparison system that applies minimum thresholds, weighted scoring, and consistency metrics.

## Minimum Thresholds

Sessions must meet **all** of the following to be included in aggregate scoring:

| Threshold | Minimum | Purpose |
|-----------|---------|---------|
| Duration | 5 minutes | Exclude trivially short sessions |
| Tool calls | 10 | Ensure meaningful work was performed |
| Human messages | 1 | Exclude pure automation scripts |

Sessions below any threshold are marked as "excluded" and do not affect your weighted score, consistency, or composite rank.

## Session Weight

Qualified sessions are weighted by their complexity. Longer sessions with more tool calls receive proportionally more weight:

```
weight = log1p(total_tool_calls) * log1p(session_duration_minutes)
```

Log scaling prevents extreme outliers (e.g., a 10-hour session) from dominating the aggregate while still giving more credit to substantial work.

**Example weights:**

| Tool Calls | Duration | Weight |
|-----------|----------|--------|
| 10 | 5 min | ~4.3 |
| 50 | 30 min | ~13.4 |
| 200 | 60 min | ~21.7 |
| 500 | 120 min | ~29.8 |

## Weighted Score

The aggregate score accounts for session weight:

```
weighted_score = sum(session.overall_score * weight(session)) / sum(weight(session))
```

This means a 60-minute session with 200 tool calls contributes roughly 5x more to your aggregate than a 5-minute session with 10 tool calls.

## Consistency Score

Measures how stable your scores are across recent sessions (0-10 scale). A perfectly consistent performer scores 10.0.

```
std_dev = standard_deviation(recent_20_sessions.overall_score)
consistency = max(0, min(10, 10 - std_dev * 3.33))
```

| Std Dev | Consistency Score |
|---------|-------------------|
| 0.0 | 10.0 (perfect) |
| 1.0 | 6.7 |
| 2.0 | 3.3 |
| 3.0+ | ~0.0 |

::: tip
Consistency rewards steady improvement over volatile swings. Even if individual sessions score lower, consistent scoring improves your composite rank.
:::

## Composite Rank Score

The final ranking metric combines weighted performance with consistency:

```
composite_rank = weighted_score * 0.8 + consistency * 0.2
```

This means 80% of your rank comes from actual performance and 20% from consistency. The formula rewards developers who reliably produce high-quality agentic sessions.

## Viewing Comparison Metrics

Comparison metrics appear automatically in the `omas report` output:

```bash
omas report
```

The output includes a panel showing:

- **Qualified**: Number of sessions meeting minimum thresholds
- **Excluded**: Number of sessions below thresholds
- **Weighted Score**: Your aggregate weighted performance
- **Consistency**: Score stability measure
- **Composite Rank**: Final ranking score

These metrics are also included in the JSON export (`omas export`) and the dashboard.
