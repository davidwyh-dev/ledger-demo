-- Chart of accounts for the demo. Single merchant ("Acme Coffee") and
-- Stripe-side accounts. Codes are the canonical identifiers used in
-- application code (see lib/ledger/accounts.ts).

INSERT INTO accounts (code, name, type, normal_balance, currency) VALUES
  -- Customer-side funding (proxy for the customer's bank/card)
  ('CUSTOMER_FUNDING_USD',     'Customer Card Funding (USD)',     'asset',     'debit',  'USD'),
  ('CUSTOMER_FUNDING_EUR',     'Customer Card Funding (EUR)',     'asset',     'debit',  'EUR'),

  -- Authorization holds (memo line, not real money yet)
  ('AUTHORIZATION_HOLD_USD',   'Authorization Holds (USD)',       'liability', 'credit', 'USD'),
  ('AUTHORIZATION_HOLD_EUR',   'Authorization Holds (EUR)',       'liability', 'credit', 'EUR'),

  -- Money in flight from card networks to Stripe
  ('PROCESSOR_RECEIVABLE_USD', 'Processor Receivable (USD)',      'asset',     'debit',  'USD'),
  ('PROCESSOR_RECEIVABLE_EUR', 'Processor Receivable (EUR)',      'asset',     'debit',  'EUR'),

  -- Stripe operating cash, post-settlement
  ('STRIPE_CASH_USD',          'Stripe Operating Cash (USD)',     'asset',     'debit',  'USD'),
  ('STRIPE_CASH_EUR',          'Stripe Operating Cash (EUR)',     'asset',     'debit',  'EUR'),

  -- What Stripe owes the merchant
  ('MERCHANT_PAYABLE_ACME_USD','Merchant Payable - Acme (USD)',   'liability', 'credit', 'USD'),
  ('MERCHANT_PAYABLE_ACME_EUR','Merchant Payable - Acme (EUR)',   'liability', 'credit', 'EUR'),

  -- Stripe revenue
  ('STRIPE_FEE_REVENUE_USD',   'Stripe Fee Revenue (USD)',        'revenue',   'credit', 'USD'),
  ('STRIPE_FX_REVENUE_USD',    'Stripe FX Margin Revenue (USD)',  'revenue',   'credit', 'USD'),

  -- Reserves and clearing
  ('DISPUTE_RESERVE_USD',      'Dispute Reserve (USD)',           'liability', 'credit', 'USD'),
  ('REFUND_CLEARING_USD',      'Refund Clearing (USD)',           'liability', 'credit', 'USD'),
  ('FX_CLEARING_USD',          'FX Clearing (USD leg)',           'asset',     'debit',  'USD'),
  ('FX_CLEARING_EUR',          'FX Clearing (EUR leg)',           'liability', 'credit', 'EUR'),

  -- Losses Stripe absorbs when reserves are insufficient
  ('CHARGEBACK_LOSS_USD',      'Chargeback Losses (USD)',         'expense',   'debit',  'USD');
