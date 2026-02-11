-- Memory v2 cutover rollback
-- Reverts table swap if post-cutover issues are detected.

BEGIN;

LOCK TABLE memory_bank IN ACCESS EXCLUSIVE MODE;
LOCK TABLE memory_bank_pre_v2 IN ACCESS EXCLUSIVE MODE;

DO $$
BEGIN
  IF to_regclass('public.memory_bank_pre_v2') IS NULL THEN
    RAISE EXCEPTION 'Rollback blocked: memory_bank_pre_v2 not found';
  END IF;
END $$;

ALTER TABLE memory_bank RENAME TO memory_bank_v2_temp_failed;
ALTER TABLE memory_bank_pre_v2 RENAME TO memory_bank;

COMMIT;

-- Post-rollback checks:
-- SELECT category, count(*) FROM memory_bank GROUP BY category ORDER BY category;
