-- Remove memory_bank rows for the deprecated 01-preferences category.
-- Run after deploying code that no longer uses Preferences in the memory system.
--
-- Optional: check count before delete:
-- SELECT count(*) FROM memory_bank WHERE category = '01-preferences';

DELETE FROM memory_bank WHERE category = '01-preferences';

-- Optional: verify after delete (should return 0):
-- SELECT count(*) FROM memory_bank WHERE category = '01-preferences';
