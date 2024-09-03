
import { index, getOpenCollectiveTransaction } from "../plugins/stripe";

describe("stripe", () => {

  let totalTransactions = 0, dateFrom = null;
  it("should be able to fetch transactions", async () => {
    const defaultValues = {
      account_name: "Citizen Spring (stripe account)",
      tags: "EUR, stripe",
    };
    const transactions = await index("", defaultValues);
    console.log(">>> transactions.length", transactions.length);
    console.log(">>> transactions", transactions);
    totalTransactions = transactions.length;
    dateFrom = transactions[Math.min(10,Math.round(transactions.length / 2))].timestamp;
    expect(transactions.length).toBeGreaterThan(0);
    expect(transactions[0].tags).toBe(defaultValues.tags);
    expect(transactions[0].account_name).toBe(defaultValues.account_name);
    expect(transactions[0].token_symbol).toBe("EUR");
    expect(transactions[0].token_decimals).toBe(2);
  });

  it.skip("get open collective transaction", async () => {
    const tx = await getOpenCollectiveTransaction("commonshub-brussels", { createdAt: new Date("2024-09-02T11:04:20.000Z"), amount: 12100 });
    expect(tx).not.toBeNull();
    expect(tx.fromCollective.slug).toBe("xdamman");
    expect(tx.order.totalAmount).toBe(12100);
  });
  it.only("get open collective transaction", async () => {
    const tx = await getOpenCollectiveTransaction("commonshub-brussels", { createdAt: new Date("2024-09-02T10:10:07.000Z"), amount: 1150 });
    expect(tx).not.toBeNull();
    expect(tx.fromCollective.slug).toBe("cedric-sounard");
    expect(tx.order.totalAmount).toBe(1150);
  });
  it.only("should be able to fetch transactions with a dateFrom", async () => {
    const defaultValues = {
      tags: "EUR, citizenspring",
    };
    const transactions = await index("", defaultValues, "2024-09-02T12:10:07.000Z");
    console.log(">>> transactions", transactions);
    expect(transactions.length).toBeLessThan(totalTransactions);
    expect(transactions.length).toBeGreaterThan(0);
    expect(transactions[0].tags).toBe(defaultValues.tags);
    expect(transactions[0].token_symbol).toBe("EUR");
    expect(transactions[0].token_decimals).toBe(2);
  });
});