CREATE TABLE users (
 id uuid PRIMARY KEY, google_sub text UNIQUE NOT NULL, email text NOT NULL, name text NOT NULL,
 locale text CHECK(locale IN ('en','ja','vi')), oauth_encrypted text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE collections (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES users(id), name text NOT NULL,
 settings jsonb NOT NULL DEFAULT '{}', revision integer NOT NULL DEFAULT 1,
 checklist_revision integer NOT NULL DEFAULT 1, sequence bigint NOT NULL DEFAULT 0,
 template_version integer NOT NULL DEFAULT 1, deleted_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX one_active_owned_collection ON collections(owner_id) WHERE deleted_at IS NULL;
CREATE TABLE memberships (
 collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES users(id), role text NOT NULL CHECK(role IN ('viewer','editor')),
 revision integer NOT NULL DEFAULT 1, PRIMARY KEY(collection_id,user_id)
);
CREATE TABLE sections (
 id uuid PRIMARY KEY, collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
 data jsonb NOT NULL, revision integer NOT NULL DEFAULT 1, UNIQUE(collection_id,id)
);
CREATE TABLE criteria (
 id uuid PRIMARY KEY, collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
 section_id uuid NOT NULL, data jsonb NOT NULL, revision integer NOT NULL DEFAULT 1,
 UNIQUE(collection_id,id), FOREIGN KEY(collection_id,section_id) REFERENCES sections(collection_id,id)
);
CREATE TABLE apartments (
 id uuid PRIMARY KEY, collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
 data jsonb NOT NULL, revision integer NOT NULL DEFAULT 1, UNIQUE(collection_id,id)
);
CREATE TABLE scenarios (
 id uuid PRIMARY KEY, collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
 data jsonb NOT NULL, revision integer NOT NULL DEFAULT 1, UNIQUE(collection_id,id)
);
CREATE TABLE answers (
 id uuid PRIMARY KEY, collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
 apartment_id uuid NOT NULL, criterion_id uuid NOT NULL, scenario_id uuid,
 data jsonb NOT NULL, revision integer NOT NULL DEFAULT 1, updated_by uuid NOT NULL REFERENCES users(id),
 updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(collection_id,id),
 FOREIGN KEY(collection_id,apartment_id) REFERENCES apartments(collection_id,id),
 FOREIGN KEY(collection_id,criterion_id) REFERENCES criteria(collection_id,id),
 FOREIGN KEY(collection_id,scenario_id) REFERENCES scenarios(collection_id,id),
 UNIQUE NULLS NOT DISTINCT (collection_id,apartment_id,criterion_id,scenario_id)
);
CREATE TABLE records (
 id uuid PRIMARY KEY, collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('cost','adjustment','benefit','payment','journey','question','attachment')),
 apartment_id uuid NOT NULL, criterion_id uuid, scenario_id uuid, data jsonb NOT NULL,
 revision integer NOT NULL DEFAULT 1, UNIQUE(collection_id,id),
 FOREIGN KEY(collection_id,apartment_id) REFERENCES apartments(collection_id,id),
 FOREIGN KEY(collection_id,criterion_id) REFERENCES criteria(collection_id,id),
 FOREIGN KEY(collection_id,scenario_id) REFERENCES scenarios(collection_id,id)
);
CREATE TABLE invitations (
 id uuid PRIMARY KEY, collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
 email text NOT NULL, role text NOT NULL CHECK(role IN ('viewer','editor')), token_hash text NOT NULL UNIQUE,
 expires_at timestamptz NOT NULL, accepted_by uuid REFERENCES users(id), revoked_at timestamptz,
 delivery text NOT NULL DEFAULT 'pending', revision integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE history (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
 entity text NOT NULL, record_id uuid NOT NULL, before_value jsonb, after_value jsonb,
 actor_id uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX history_record ON history(collection_id,record_id,id DESC);
CREATE TABLE events (
 collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE, sequence bigint NOT NULL,
 entity text NOT NULL, record_id uuid, payload jsonb, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(collection_id,sequence)
);
CREATE TABLE mutation_receipts (
 collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
 actor_id uuid NOT NULL REFERENCES users(id), mutation_id uuid NOT NULL, request_hash text NOT NULL,
 result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(collection_id,actor_id,mutation_id)
);
