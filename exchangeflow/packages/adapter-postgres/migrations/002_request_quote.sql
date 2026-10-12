-- Indicative "give the member" quote per request revision. Amounts, rates and feed times only: no member name (privacy), no PII.
CREATE TABLE request_quote (
  request_id uuid NOT NULL REFERENCES exchange_request,
  revision int NOT NULL,
  quote jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (request_id, revision)
);
