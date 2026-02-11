# Memory v2 Post-Cutover Notes

## Current State
- Live table `memory_bank` is on v2 categories only:
  - `00-personal-core`
  - `01-interest-core`
  - `02-active-context`
- Rollback table `memory_bank_pre_v2` is retained temporarily.
- Legacy categories in live table were cleaned up.

## Rollback (if needed during retention window)
1. Run `memory_v2_cutover_rollback.sql`.
2. Re-check memory endpoints.
3. Investigate failed rows in `memory_bank_v2_temp_failed`.

## Operational Notes
- Do not drop `memory_bank_pre_v2` until production stability is confirmed.
- Retention policy for `memory_bank_pre_v2`: **14 days** after cutover.
- Cutover execution date: 2026-02-11 (UTC). Earliest cleanup date: **2026-02-25 (UTC)**.
- Cleanup is manual (not automatic). Execute after the retention window:
  - `DROP TABLE IF EXISTS memory_bank_pre_v2;`
- Keep migration run IDs for auditability.
- Re-running generation is idempotent due `on conflict (user_id, category)`.
