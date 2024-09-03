const config = require("./config.json");
const indexer = require("./indexer");
for (const account of config.accounts) {
  console.log(">>> processing", account.label);
}
