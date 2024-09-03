const { ethers } = require("ethers");
const sqlite3 = require("sqlite3").verbose();
const minimist = require("minimist");
const indexer = require("../lib/indexer");

// Parse command line arguments
const args = minimist(process.argv.slice(2), { string: ["_"] });
const chainId = args._[0];
const contractAddress = args._[1];
const walletAddress = args._[2];
const startBlockArg = args.since || "latest";
const reset = args.reset || false;

if (!chainId || !contractAddress || !walletAddress) {
  console.error(
    "Usage: node index.js [chainId] [ERC20ContractAddress] [walletAddress] --since [blockNumber]"
  );
  process.exit(1);
}

if (!ethers.isAddress(contractAddress)) {
  console.error("Invalid ERC20 contract address", contractAddress);
  process.exit(1);
}

if (!ethers.isAddress(walletAddress)) {
  console.error("Invalid wallet address", walletAddress);
  process.exit(1);
}

// Function to start listening for events
async function startIndexing() {
  // Set up ethers to connect to the appropriate chain based on chainId

  if (reset) {
    const db = new sqlite3.Database("./events.sqlite", (err) => {
      if (err) {
        console.error("Error opening database:", err.message);
        process.exit(1);
      } else {
        db.run(`DROP TABLE events`, (err) => {
          if (err) {
            console.error("Error dropping table events:", err.message);
            // process.exit(1);
          }
          console.log("Dropped table events from the database.");
        });
      }
    });
  }

  await indexer(chainId, contractAddress, walletAddress, startBlockArg);

  console.log("Finished fetching historical events.");
}

startIndexing();
