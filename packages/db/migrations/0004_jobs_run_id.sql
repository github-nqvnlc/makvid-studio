-- 0004: jobs.version_id holds the production *run* id. A run's version row is written only when the run
-- finishes (or up front for chat edits), so jobs cannot reference project_versions while they run.
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_version_id_fkey;
COMMENT ON COLUMN jobs.version_id IS 'production run id (= project_versions.id once the run has produced a version)';
