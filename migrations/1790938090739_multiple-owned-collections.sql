-- Preserve every existing collection while allowing multiple per owner.
CREATE INDEX active_owned_collections ON collections(owner_id) WHERE deleted_at IS NULL;
DROP INDEX one_active_owned_collection;
