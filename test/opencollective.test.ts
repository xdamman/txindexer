const collectiveSlug = "commonshub-brussels";

import { index } from "../plugins/opencollective";

describe("opencollective", () => {

  let totalTransactions = 0, dateFrom = null;
  it.skip("should be able to fetch transactions", async () => {
    const defaultValues = {
      account_name: "Commons Hub Brussels (opencollective account)",
      tags: "EUR, commonshub-brussels",
    };
    const transactions = await index(collectiveSlug, defaultValues);
    // console.log(">>> transactions.length", transactions.length);
    totalTransactions = transactions.length;
    dateFrom = transactions[Math.min(10,Math.round(transactions.length / 2))].timestamp;
    expect(transactions.length).toBeGreaterThan(0);
    expect(transactions[0].tags).toBe(defaultValues.tags);
    expect(transactions[0].account_name).toBe(defaultValues.account_name);
    expect(transactions[0].token_symbol).toBe("EUR");
    expect(transactions[0].token_decimals).toBe(2);
  });
  it.skip("should be able to fetch transactions with a dateFrom", async () => {
    const defaultValues = {
      tags: "EUR, citizenspring",
    };
    const transactions = await index(collectiveSlug, defaultValues, dateFrom);
    expect(transactions.length).toBeLessThan(totalTransactions);
    // console.log(">>> transactions.length", transactions.length);
    expect(transactions.length).toBeGreaterThan(0);
    expect(transactions[0].tags).toBe(defaultValues.tags);
    expect(transactions[0].token_symbol).toBe("EUR");
    expect(transactions[0].token_decimals).toBe(2);
  });
});