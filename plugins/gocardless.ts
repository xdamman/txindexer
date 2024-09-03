/**
 * GoCardless plugin
 * 
 * Requires:
 * - process.env.GOCARDLESS_SECRET_ID
 * - process.env.GOCARDLESS_SECRET_KEY
 */

import NordigenClient from "nordigen-node";
import { Transaction } from "../types/db";

interface Filter {
  dateFrom?: string;
  [key: string]: string | undefined;
}

if (!process.env.GOCARDLESS_SECRET_ID) {
  throw new Error("GOCARDLESS_SECRET_ID is not set");
}

if (!process.env.GOCARDLESS_SECRET_KEY) {
  throw new Error("GOCARDLESS_SECRET_KEY is not set");
}

const baseUrl = "https://bankaccountdata.gocardless.com/api/v2";


const apiCall = async (path: string, params: any, method: string = "POST") => {
  const res = await fetch(baseUrl + path, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });
  return res.json();
}

let tokenData: any = {};
const getToken = async () => {
  if (process.env.GOCARDLESS_ACCESS_TOKEN) {
    return process.env.GOCARDLESS_ACCESS_TOKEN;
  }

  if (tokenData?.access) {
    return tokenData.access;
  }
  
  tokenData = await apiCall("/token/new/", {
    secret_id: process.env.GOCARDLESS_SECRET_ID,
    secret_key: process.env.GOCARDLESS_SECRET_KEY,
  });
  return tokenData.access;
}

const refreshToken = async () => {
  const data = await apiCall("/token/refresh/", {
    refresh: tokenData.refresh,
  });
  tokenData.access = data.access;
  return tokenData.access;
}

const getTransactions = async (accountId: string, filter?: Filter) => {
  const token = await getToken();
  let apicall = baseUrl + "/accounts/" + accountId + "/transactions/";
  if (filter) {
    apicall += "?" + new URLSearchParams(filter).toString();
  }
  console.log("Fetching transactions from", apicall);
  const res = await fetch(apicall, {
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + token,
    },
  });
  const data = await res.json();
  if (data.status_code) {
    console.error("GoCardless API error: " + data.status_code + " " + data.summary + " " + data.detail);
    return [];
  }
  console.log("Transactions", data);
  return data.transactions.booked;
}


let interval = setInterval(async () => {
  console.log("Refreshing GoCardLess access token");
  await refreshToken();
}, 1000 * 60 * 60 * 18);

export async function close() {
  clearInterval(interval);
}

export async function index(providerAccount: string, defaultValues: Partial<Transaction>, cursor?: string): Promise<Transaction[]>  {
  console.log(`gocardless: indexing transactions from ${cursor} for ${providerAccount}`);

  const filter: Filter = {};
  if (cursor) {
    filter.dateFrom = cursor;
  }

  const transactions = await getTransactions(providerAccount, filter);

  return transactions.map((transaction) => {

    const value = Math.round(parseFloat(transaction.transactionAmount.amount) * 100);

    const tx = {
      ...defaultValues,
      provider: "gocardless",
      provider_tx_id: transaction.internalTransactionId,
      type: transaction.proprietaryBankTransactionCode === "TRANSFER" ? "TRANSFER" : "INTERNAL",
      description: (transaction.additionalInformation || transaction.remittanceInformationUnstructured).trim(),
      timestamp: new Date(transaction.bookingDateTime).toISOString(),
      value,
      token_symbol: transaction.transactionAmount.currency,
      token_decimals: 2,
    }

    if (transaction.debtorAccount) {
      tx.counterparty_address = transaction.debtorAccount.iban;
      tx.counterparty_name = transaction.debtorName;
    }

    if (transaction.creditorAccount) {
      tx.counterparty_address = transaction.creditorAccount.iban;
      tx.counterparty_name = transaction.creditorName;
    }

    return tx;
  });
}
