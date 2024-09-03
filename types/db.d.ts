export type Transaction = {
  timestamp: string;
  collectiveSlug?: string; // could be unassigned yet
  account_name?: string;
  account_address?: string;
  counterparty_name?: string;
  counterparty_address: string;
  counterparty_profile?: string;
  value: number;
  token_symbol: string;
  token_decimals: number;
  type: string; // TRANSFER, INTERNAL
  tags?: string;
  description?: string;
  provider: string; // stripe, opencollective, gocardless, gnosis, polygon
  provider_tx_id: string;
  provider_account: string;
  invoice_uuid?: number;
  data?: string;
};