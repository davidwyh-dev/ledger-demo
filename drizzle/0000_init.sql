-- Ledger demo schema. The invariants in this file ARE the demo:
-- the visible /how-it-works page renders this SQL with prose
-- explaining what each invariant prevents.

-- =====================================================
-- CURRENCIES
-- =====================================================
CREATE TABLE currencies (
  code        CHAR(3) PRIMARY KEY,
  minor_unit  SMALLINT NOT NULL,
  symbol      TEXT    NOT NULL
);

-- =====================================================
-- FX RATES (immutable snapshots)
-- =====================================================
CREATE TABLE fx_rates (
  id            BIGSERIAL PRIMARY KEY,
  from_ccy      CHAR(3)  NOT NULL REFERENCES currencies(code),
  to_ccy        CHAR(3)  NOT NULL REFERENCES currencies(code),
  rate          NUMERIC(20, 10) NOT NULL CHECK (rate > 0),
  effective_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  source        TEXT     NOT NULL DEFAULT 'demo-static'
);
CREATE INDEX fx_rates_lookup ON fx_rates (from_ccy, to_ccy, effective_at DESC);

-- =====================================================
-- CHART OF ACCOUNTS
-- =====================================================
CREATE TYPE account_type   AS ENUM ('asset','liability','revenue','expense','equity');
CREATE TYPE account_normal AS ENUM ('debit','credit');

CREATE TABLE accounts (
  id              BIGSERIAL PRIMARY KEY,
  code            TEXT UNIQUE NOT NULL,
  name            TEXT NOT NULL,
  type            account_type   NOT NULL,
  normal_balance  account_normal NOT NULL,
  currency        CHAR(3) NOT NULL REFERENCES currencies(code),
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- TRANSACTIONS (logical events)
-- =====================================================
CREATE TYPE txn_kind AS ENUM (
  'authorize','capture','settle','fee','payout',
  'refund','dispute_open','dispute_won','dispute_lost',
  'fx_conversion','reversal'
);

CREATE TABLE transactions (
  id            BIGSERIAL PRIMARY KEY,
  external_id   TEXT UNIQUE,
  kind          txn_kind NOT NULL,
  description   TEXT     NOT NULL,
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  reverses_id   BIGINT REFERENCES transactions(id),
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX transactions_occurred_at ON transactions (occurred_at DESC);

-- =====================================================
-- POSTINGS (immutable debits/credits)
--
-- amount_minor  is always positive
-- signed_amount is debit:+/credit:- so SUM() detects imbalance trivially
-- =====================================================
CREATE TABLE postings (
  id              BIGSERIAL PRIMARY KEY,
  transaction_id  BIGINT NOT NULL REFERENCES transactions(id),
  account_id      BIGINT NOT NULL REFERENCES accounts(id),
  direction       account_normal NOT NULL,
  amount_minor    BIGINT NOT NULL CHECK (amount_minor > 0),
  currency        CHAR(3) NOT NULL REFERENCES currencies(code),
  signed_amount   BIGINT GENERATED ALWAYS AS (
                    CASE direction
                      WHEN 'debit'  THEN  amount_minor
                      ELSE              -amount_minor
                    END
                  ) STORED,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX postings_by_txn     ON postings (transaction_id);
CREATE INDEX postings_by_account ON postings (account_id, created_at DESC);

-- =====================================================
-- INVARIANT 1: posting currency must match account currency
-- =====================================================
CREATE OR REPLACE FUNCTION assert_posting_currency()
RETURNS TRIGGER AS $$
DECLARE acct_ccy CHAR(3);
BEGIN
  SELECT currency INTO acct_ccy FROM accounts WHERE id = NEW.account_id;
  IF acct_ccy IS NULL THEN
    RAISE EXCEPTION 'Posting references unknown account %', NEW.account_id;
  END IF;
  IF acct_ccy <> NEW.currency THEN
    RAISE EXCEPTION
      'Ledger invariant violated: posting currency % does not match account % currency %',
      NEW.currency, NEW.account_id, acct_ccy;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER postings_currency_check
  BEFORE INSERT ON postings
  FOR EACH ROW EXECUTE FUNCTION assert_posting_currency();

-- =====================================================
-- INVARIANT 2: per-currency sum-zero per transaction
--
-- Constraint trigger DEFERRABLE INITIALLY DEFERRED so it
-- fires at COMMIT, after all postings in a txn are inserted.
-- =====================================================
CREATE OR REPLACE FUNCTION assert_txn_balanced()
RETURNS TRIGGER AS $$
DECLARE
  unbalanced RECORD;
BEGIN
  SELECT currency, SUM(signed_amount) AS net
  INTO unbalanced
  FROM postings
  WHERE transaction_id = NEW.transaction_id
  GROUP BY currency
  HAVING SUM(signed_amount) <> 0
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION
      'Ledger invariant violated: transaction % currency % net = % (must be 0)',
      NEW.transaction_id, unbalanced.currency, unbalanced.net;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER postings_balance_check
  AFTER INSERT ON postings
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION assert_txn_balanced();

-- =====================================================
-- INVARIANT 3: append-only on postings and transactions
--
-- Corrections happen via a NEW transaction with reverses_id set,
-- never by mutating prior records.
-- =====================================================
CREATE OR REPLACE FUNCTION reject_mutation() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    'Ledger invariant violated: % is append-only. Use a compensating transaction with reverses_id instead.',
    TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER postings_no_update     BEFORE UPDATE ON postings     FOR EACH ROW EXECUTE FUNCTION reject_mutation();
CREATE TRIGGER postings_no_delete     BEFORE DELETE ON postings     FOR EACH ROW EXECUTE FUNCTION reject_mutation();
CREATE TRIGGER transactions_no_update BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION reject_mutation();
CREATE TRIGGER transactions_no_delete BEFORE DELETE ON transactions FOR EACH ROW EXECUTE FUNCTION reject_mutation();

-- =====================================================
-- BALANCES VIEW (computed, never stored)
--
-- For an asset/expense account (normal=debit), balance grows
-- on debits and shrinks on credits, and vice versa.
-- =====================================================
CREATE VIEW account_balances AS
SELECT
  a.id,
  a.code,
  a.name,
  a.type,
  a.currency,
  COALESCE(SUM(
    CASE WHEN a.normal_balance = p.direction THEN p.amount_minor
         ELSE -p.amount_minor
    END
  ), 0)::BIGINT AS balance_minor
FROM accounts a
LEFT JOIN postings p ON p.account_id = a.id
GROUP BY a.id, a.code, a.name, a.type, a.currency;
