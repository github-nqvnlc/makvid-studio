-- 0007: project list search (spec 002, US5). Accent-insensitive title search ("dong ho" finds "Đồng hồ") and the
-- indexes the filtered, paginated list needs.
--
-- unaccent and pg_trgm are trusted extensions, so the database owner can create them. unaccent() itself is only
-- STABLE, so mkv_fold wraps it as IMMUTABLE (the dictionary never changes at runtime), which an index requires.

CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE FUNCTION mkv_fold(text) RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS
$$ SELECT replace(lower(public.unaccent('public.unaccent', $1)), 'đ', 'd') $$;
GRANT EXECUTE ON FUNCTION mkv_fold(text) TO makvid_app;

CREATE INDEX projects_title_fold_trgm ON projects USING gin (mkv_fold(title) gin_trgm_ops) WHERE deleted_at IS NULL;
CREATE INDEX projects_ws_created ON projects (workspace_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX projects_ws_updated ON projects (workspace_id, updated_at DESC) WHERE deleted_at IS NULL;
