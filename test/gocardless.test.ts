const account_id = "d4d1dda4-2d8f-4467-871c-fc70904e78b3";

import { index, close } from "../plugins/gocardless";

describe("gocardless", () => {

  afterAll(async () => {
    await close();
  });

  it.skip("should be able to fetch transactions", async () => {
    const defaultValues = {
      account_name: "Citizen Spring (wise account)",
      tags: "EUR, citizenspring",
    };
    const transactions = await index(account_id, defaultValues);
    console.log(">>> transactions.length", transactions.length);
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
    const transactions = await index(account_id, defaultValues, '2024-07-01T01:20:34.000Z');
    console.log(">>> transactions.length", transactions.length);
    console.log(transactions);
    expect(transactions.length).toBeGreaterThan(0);
    expect(transactions[0].tags).toBe(defaultValues.tags);
    expect(transactions[0].token_symbol).toBe("EUR");
    expect(transactions[0].token_decimals).toBe(2);
  });
});