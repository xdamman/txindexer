/**
 * Open Collective plugin
 * 
 * Requires:
 * - process.env.OPENCOLLECTIVE_GRAPHQL_API
 */

import { Transaction } from "../types/db";
import { GraphQLClient, gql } from "graphql-request";
import AbortController from "abort-controller";

interface Filter {
  dateFrom?: string;
  [key: string]: string | undefined;
}

if (!process.env.OPENCOLLECTIVE_GRAPHQL_API) {
  throw new Error("OPENCOLLECTIVE_GRAPHQL_API is not set");
}


const transactionsQuery = gql`
  query getTransactions(
    $collectiveSlug: String!
    $dateFrom: String
    $dateTo: String
    $limit: Int
  ) {
    allTransactions(
      collectiveSlug: $collectiveSlug
      dateFrom: $dateFrom
      dateTo: $dateTo
      limit: $limit
    ) {
      id
      uuid
      createdAt
      hostCurrency
      amount
      description
      fromCollective {
        slug
        name
        imageUrl
      }
    }
  }
`;

export const getTransactions = async (
  collectiveSlug: string,
  dateFrom?: Date,
  dateTo?: Date,
  limit?: number
) => {
  if (!collectiveSlug) throw new Error("Missing collectiveSlug");

  const slugParts = collectiveSlug.split("/");
  const slug = slugParts[slugParts.length - 1];
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 3000);
  const graphQLClient = new GraphQLClient(
    process.env.OPENCOLLECTIVE_GRAPHQL_API || "",
    {
      // @ts-ignore
      signal: controller.signal,
    }
  );
  try {
    const res: any = await graphQLClient.request(transactionsQuery, {
      collectiveSlug: slug,
      dateFrom,
      limit,
    });
    if (!res.allTransactions) return [];
    const transactions = res.allTransactions || [];    
    return transactions;
  } catch (e) {
    console.error(">>> error", e);
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
};

export async function index(providerAccount: string, defaultValues: Partial<Transaction>, cursor?: string): Promise<Transaction[]>  {
  console.log(`opencollective: indexing transactions from ${cursor} for ${providerAccount}`);

  const transactions = await getTransactions(providerAccount, cursor ? new Date(cursor) : undefined);

  return transactions.map((transaction) => {

    const tx = {
      ...defaultValues,
      provider: "opencollective",
      provider_tx_id: transaction.uuid,
      account_address: `https://opencollective.com/${providerAccount}`,
      counterparty_name: transaction.fromCollective.name,
      counterparty_address: `https://opencollective.com/${transaction.fromCollective.slug}`,
      counterparty_profile: JSON.stringify({
        name: transaction.fromCollective.name,
        imageUrl: transaction.fromCollective.imageUrl,
      }),
      type: "TRANSFER",
      description: transaction.description.trim(),
      timestamp: new Date(transaction.createdAt).toISOString(),
      value: transaction.amount,
      token_symbol: transaction.hostCurrency,
      token_decimals: 2,
    }

    return tx;
  });
}
