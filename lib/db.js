const sqlite3 = require("sqlite3").verbose();

const events_table_schema = `CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        parent_id INTEGER,
        timestamp INTEGER,
        block_number INTEGER,
        event_name TEXT,
        "from" TEXT,
        "to" TEXT,
        "value" TEXT,
        tags TEXT,
        description TEXT
      )`;

/**
 * stripe://process.env.STRIPE_SECRET/:product_id,:product_id
 * opencollective://:collectiveSlug
 * gocardless://process.env.GOCARDLESS_SECRET_ID/:account_id,:account_id
 * gnosis://:token_address/:account_address
 *
 * :provider, :provider_account, [:accountAddress]
 * e.g. gnosis, EURb, [0x..., 0x...]
 *      gocardless, process.env.GOCARDLESS_SECRET_ID, [:account_id, :account_id]
 *      stripe, process.env.STRIPE_SECRET, [:product_id, :product_id]
 *      opencollective, :collectiveSlug
 *
 * For each record, we index all transactions for the given account address (if any)
 * the cursor keeps track of the last item indexed (block number or timestamp for gocardless or stripe)
 */

const indexer_table_schema = `CREATE TABLE IF NOT EXISTS indexer (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at DATETIME,
        updated_at DATETIME,
        label TEXT,
        provider TEXT, // stripe, opencollective, gocardless, gnosis, polygon
        provider_account TEXT, // :collectiveSlug, :token_address[/:account_address]
        filter TEXT, // [:product_id]
        cursor TEXT, // block number or timestamp
      )`;

const transactions_table_schema = `CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME,
        collectiveSlug TEXT,
        account_address TEXT,
        counterparty_address TEXT,
        counterparty_name TEXT,
        value INTEGER, // bigint
        token_symbol TEXT,
        token_decimals INTEGER,
        type: TEXT, // TRANSFER, INTERNAL
        tags TEXT,
        description TEXT,
        provider TEXT, // stripe, opencollective, gocardless, gnosis, polygon
        provider_tx_id TEXT,
        provider_account TEXT,
        invoice_id INTEGER,
        UNIQUE(provider, provider_tx_id)
      )`;

const setupDB = async () => {
  const db = new sqlite3.Database("./events.sqlite", (err) => {
    return new Promise((resolve, reject) => {
      if (err) {
        console.error("Error opening database:", err.message);
        process.exit(1);
        reject(err);
      } else {
        console.log("Connected to SQLite database.");
        db.run(events_table_schema, (err) => {
          if (err) {
            console.error("Error creating table:", err.message);
          } else {
            resolve(db);
          }
        });
      }
    });
  });
  return db;
};

module.exports = { setupDB };
