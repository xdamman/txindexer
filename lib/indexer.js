const { ethers } = require("ethers");
const sqlite3 = require("sqlite3").verbose();
const contractABI = require("../ABIs/erc20.abi.json");
const { setupDB } = require("./db");
// Connect to SQLite database

async function getBlockTimestamp(provider, blockNumber) {
  const block = await provider.getBlock(blockNumber);
  return block.timestamp;
}

// Function to start indexing events
const indexer = async function (
  chainId,
  contractAddress,
  walletAddress,
  startBlock,
  endBlock
) {
  // Set up ethers to connect to the appropriate chain based on chainId
  const rpcUrls = {
    1: "https://mainnet.infura.io/v3/YOUR_INFURA_PROJECT_ID",
    56: "https://bsc-dataseed.binance.org/",
    137: "https://rpc-mainnet.maticvigil.com/",
    100: "https://rpc.gnosischain.com",
  };

  if (!rpcUrls[chainId]) {
    console.error("Unsupported chainId");
    process.exit(1);
  }

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

  const provider = new ethers.JsonRpcProvider(rpcUrls[chainId]);
  const contract = new ethers.Contract(contractAddress, contractABI, provider);

  const db = await setupDB();

  // Fetch the highest block number recorded in the database
  db.get(
    `SELECT MAX(block_number) as lastBlock FROM events`,
    async (err, row) => {
      if (err) {
        console.error("Error querying last block number:", err.message);
        process.exit(1);
      }

      let _startBlock = startBlock;
      if (row && row.lastBlock) {
        _startBlock = row.lastBlock + 1; // Continue from the next block
        console.log(`Resuming from block number ${startBlock}`);
      } else {
        console.log(`Starting from specified block number: ${startBlock}`);
      }

      const _endBlock = endBlock || (await provider.getBlockNumber());
      const chunkSize = 10000; // Adjust chunk size as needed

      for (
        let fromBlock = _startBlock;
        fromBlock <= _endBlock;
        fromBlock += chunkSize
      ) {
        const toBlock = Math.min(fromBlock + chunkSize - 1, _endBlock);
        // console.log(`Fetching events from block ${fromBlock} to ${toBlock}`);

        try {
          const filter = {
            fromBlock,
            toBlock,
            address: contractAddress,
            topics: [
              ethers.id("Transfer(address,address,uint256)"),
              // ethers.zeroPadValue(walletAddress, 32),
            ],
          };
          const logs = await provider.getLogs(filter);
          function stringifyWithBigInt(obj) {
            return JSON.stringify(obj, (key, value) => {
              return typeof value === "bigint" ? value.toString() : value;
            });
          }
          for (const log of logs) {
            const parsedLog = contract.interface.parseLog(log);
            const eventName = parsedLog.name;
            const eventData = stringifyWithBigInt(parsedLog.args);
            const blockNumber = log.blockNumber;
            console.log(blockNumber, eventName, eventData);
            const timestamp = await getBlockTimestamp(provider, blockNumber);

            // Insert event into SQLite database
            db.run(
              `INSERT INTO events ("timestamp", "block_number", "event_name", "from", "to", "value") VALUES (?, ?, ?, ?, ?, ?)`,
              [
                timestamp,
                blockNumber,
                eventName,
                eventData[0],
                eventData[1],
                eventData[2],
              ],
              function (err) {
                if (err) {
                  return console.error("Error inserting event:", err.message);
                }
                console.log(
                  `Event recorded: ${eventName} at block ${blockNumber}`
                );
              }
            );
          }
        } catch (err) {
          console.error(
            `Error fetching logs for blocks ${fromBlock} to ${toBlock}:`,
            err
          );
        }
      }

      console.log("Finished fetching historical events.");
    }
  );
};

module.exports = indexer;
