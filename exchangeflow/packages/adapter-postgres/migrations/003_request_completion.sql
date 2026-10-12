-- What the teller actually did at completion: amounts, rate and reference. No member name (privacy). Written in the same transaction as the COMPLETE transition and its audit event (INV-TX-1).
CREATE TABLE request_completion (
  request_id uuid PRIMARY KEY REFERENCES exchange_request,
  revision int NOT NULL,
  handed_over jsonb NOT NULL,
  given jsonb NOT NULL,
  rate_applied text NOT NULL,
  rate_side text NOT NULL,
  reference text NOT NULL,
  quoted_give jsonb,
  completed_by text NOT NULL REFERENCES users,
  completed_at timestamptz NOT NULL
);
