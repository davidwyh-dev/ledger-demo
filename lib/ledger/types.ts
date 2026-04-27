export type Direction = 'debit' | 'credit';

export type TxnKind =
  | 'authorize'
  | 'capture'
  | 'settle'
  | 'fee'
  | 'payout'
  | 'refund'
  | 'dispute_open'
  | 'dispute_won'
  | 'dispute_lost'
  | 'fx_conversion'
  | 'reversal';

/** A single line of a transaction (a debit or a credit on one account, in one currency). */
export type PostingInput = {
  accountCode: string;
  direction: Direction;
  amountMinor: number;
  currency: string;
};

export type TransactionInput = {
  kind: TxnKind;
  description: string;
  externalId?: string;
  reversesId?: number;
  metadata?: Record<string, unknown>;
  occurredAt?: Date;
  postings: PostingInput[];
};

export type LedgerError = {
  code: 'INVARIANT_VIOLATED' | 'UNKNOWN_ACCOUNT' | 'OTHER';
  message: string;
  pgCode?: string;
};
