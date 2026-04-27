INSERT INTO currencies (code, minor_unit, symbol) VALUES
  ('USD', 2, '$'),
  ('EUR', 2, '€'),
  ('GBP', 2, '£'),
  ('JPY', 0, '¥');

-- Static rates for the demo. Rate is "amount of to_ccy per 1 unit of from_ccy".
INSERT INTO fx_rates (from_ccy, to_ccy, rate) VALUES
  ('USD', 'EUR', 0.9259259259),  -- 1 USD = ~0.926 EUR  (i.e. 1 EUR ≈ 1.08 USD)
  ('EUR', 'USD', 1.0800000000),
  ('USD', 'GBP', 0.7900000000),
  ('GBP', 'USD', 1.2658227848),
  ('USD', 'JPY', 152.0000000000),
  ('JPY', 'USD', 0.0065789474);
