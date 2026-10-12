-- ExchangeFlow local schema (PostgreSQL 16). IDs and hashes in audit; no customer PII in audit rows.
CREATE TABLE branches (branch_id text PRIMARY KEY, name text NOT NULL, timezone text NOT NULL);
CREATE TABLE users (id text PRIMARY KEY, display_name text NOT NULL, roles text[] NOT NULL, branch_id text REFERENCES branches, active boolean NOT NULL DEFAULT true);
CREATE TABLE sessions (id text PRIMARY KEY, user_id text NOT NULL REFERENCES users, created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL);

CREATE TABLE exchange_request (
  id uuid PRIMARY KEY, status text NOT NULL, version int NOT NULL, cycle int NOT NULL,
  submitter_id text NOT NULL REFERENCES users, branch_id text NOT NULL REFERENCES branches,
  escalated boolean NOT NULL DEFAULT false, current_revision int NOT NULL,
  created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL
);
CREATE INDEX exchange_request_branch ON exchange_request (branch_id, status);
CREATE TABLE request_revision (
  request_id uuid NOT NULL REFERENCES exchange_request, revision int NOT NULL, "values" jsonb NOT NULL,
  values_hash text NOT NULL, created_at timestamptz NOT NULL, PRIMARY KEY (request_id, revision)
);

CREATE TABLE policy_version (id text PRIMARY KEY, number int NOT NULL, policy_hash text NOT NULL, manifest jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE policy_control (
  id int PRIMARY KEY CHECK (id = 1), control_revision int NOT NULL, global_paused boolean NOT NULL,
  paused_rule_ids jsonb NOT NULL DEFAULT '[]', current_policy_version_id text REFERENCES policy_version
);
CREATE TABLE control_event (id bigserial PRIMARY KEY, control_revision int NOT NULL, action text NOT NULL, actor text NOT NULL, reason text NOT NULL, at timestamptz NOT NULL DEFAULT now());

CREATE TABLE decision_record (
  id uuid PRIMARY KEY, seq bigserial UNIQUE, request_id uuid NOT NULL REFERENCES exchange_request, cycle int NOT NULL,
  request_revision int NOT NULL, policy_version_id text, policy_hash text, control_revision int NOT NULL,
  context_snapshot jsonb NOT NULL, context_hash text NOT NULL, as_of timestamptz NOT NULL, engine_version text NOT NULL,
  outcome text NOT NULL, applied_outcome text NOT NULL, fallback_cause text, deciding_rule_key text,
  matched_rules jsonb NOT NULL, shadow_results jsonb NOT NULL, alerts jsonb NOT NULL,
  reason_code text NOT NULL, reason_text text NOT NULL,
  restricted jsonb NOT NULL DEFAULT '{}',  -- restricted part, never selected by general queries (ADR-026)
  created_at timestamptz NOT NULL, UNIQUE (request_id, cycle)
);
CREATE TABLE review_decision (
  id uuid PRIMARY KEY, request_id uuid NOT NULL REFERENCES exchange_request, cycle int NOT NULL,
  decision_record_id uuid REFERENCES decision_record, decision_type text NOT NULL, reviewer_id text NOT NULL REFERENCES users,
  reason text, at timestamptz NOT NULL, UNIQUE (request_id, cycle)
);
CREATE TABLE idempotency (submitter_id text NOT NULL, key text NOT NULL, payload_hash text NOT NULL, response jsonb, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (submitter_id, key));

-- Hash-chained, insert-only audit with one head row (ADR-012, ADR-027).
CREATE TABLE audit_head (id int PRIMARY KEY CHECK (id = 1), seq bigint NOT NULL, hash text NOT NULL);
INSERT INTO audit_head VALUES (1, 0, repeat('0', 64));
CREATE TABLE audit_event (
  seq bigint PRIMARY KEY, prev_hash text NOT NULL, hash text NOT NULL, actor_id text NOT NULL, actor_roles jsonb NOT NULL,
  action text NOT NULL, target_type text NOT NULL, target_id text NOT NULL, correlation_id text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}', at timestamptz NOT NULL
);
CREATE INDEX audit_target ON audit_event (target_id, seq);
CREATE FUNCTION audit_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit_event is insert-only'; END $$;
CREATE TRIGGER audit_no_update BEFORE UPDATE OR DELETE ON audit_event FOR EACH ROW EXECUTE FUNCTION audit_immutable();
CREATE TRIGGER audit_no_truncate BEFORE TRUNCATE ON audit_event FOR EACH STATEMENT EXECUTE FUNCTION audit_immutable();

CREATE FUNCTION audit_append(p_actor text, p_roles jsonb, p_action text, p_ttype text, p_tid text, p_corr text, p_detail jsonb, p_at timestamptz)
RETURNS TABLE (seq bigint, hash text) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE h audit_head%ROWTYPE; nseq bigint; nhash text;
BEGIN
  SELECT * INTO h FROM audit_head WHERE id = 1 FOR UPDATE;  -- last lock in the fixed order (INV-LOCK-ORDER)
  nseq := h.seq + 1;
  nhash := encode(sha256(convert_to(h.hash || '|' || nseq || '|' || p_actor || '|' || p_action || '|' || p_ttype || '|' || p_tid || '|' || p_corr || '|' || p_detail::text, 'UTF8')), 'hex');
  INSERT INTO audit_event VALUES (nseq, h.hash, nhash, p_actor, p_roles, p_action, p_ttype, p_tid, p_corr, p_detail, p_at);
  UPDATE audit_head SET seq = nseq, hash = nhash WHERE id = 1;
  RETURN QUERY SELECT nseq, nhash;
END $$;

CREATE TABLE outbox (
  id bigserial PRIMARY KEY, type text NOT NULL, payload jsonb NOT NULL, dedupe_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(), delivered_at timestamptz, attempts int NOT NULL DEFAULT 0
);
CREATE INDEX outbox_pending ON outbox (id) WHERE delivered_at IS NULL;
CREATE TABLE inbox (id bigserial PRIMARY KEY, user_id text NOT NULL REFERENCES users, request_id uuid, kind text NOT NULL, message text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), read_at timestamptz);
CREATE INDEX inbox_user ON inbox (user_id, id DESC);
