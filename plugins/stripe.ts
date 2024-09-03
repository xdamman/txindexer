// Import the Stripe library
import Stripe from "stripe";
import { Transaction } from "../types/db";
import { v4 as uuidV4 } from "uuid";

import { GraphQLClient, gql } from "graphql-request";


if (!process.env.STRIPE_SECRET) {
  throw new Error("STRIPE_SECRET is not set");
}

// Initialize Stripe with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET || "");

const OPENCOLLECTIVE_APPLICATION_ID = "ca_68FQ4jN0XMVhxpnk6gAptwvx90S9VYXF";
const applicationName = (application: string) => {
  if (application === OPENCOLLECTIVE_APPLICATION_ID) return "opencollective";
    return "Stripe";
}


// Function to get the latest balance transactions
export async function getTransactions(
  dateFrom?: Date,
  dateTo?: Date,
  limit?: number
) {
    // Fetch the list of balance transactions
    const transactions = await stripe.charges.list({
      limit: limit || 10, // Number of transactions to retrieve
      created: {
        gte: dateFrom ? Math.floor(dateFrom.getTime() / 1000) : undefined,
        lte: dateTo ? Math.floor(dateTo.getTime() / 1000) : undefined,
      },
    });

    return transactions.data;
}

async function getDetailsFromPaymentMethod(paymentMethodId: string) {
  const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
  return paymentMethod;
}

async function getDetailsFromPaymentIntent(paymentIntentId: string) {
  const sessions = await stripe.checkout.sessions.list({
    payment_intent: paymentIntentId,
  });
  if (sessions.data.length === 0) {
    return null;
  }
  const res = await stripe.checkout.sessions.listLineItems(sessions.data[0].id);
  return {
    metadata: sessions.data[0].metadata,
    lineItems: res?.data,
  };
}

async function getInvoiceDetails(invoiceId: string) {
  try {
    // Retrieve the invoice
    const invoice = await stripe.invoices.retrieve(invoiceId, {
      expand: ["lines.data.price.product"], // Expand to include product details
    });

    // Log the invoice details
    // console.log(`Invoice ID: ${invoice.id}`);
    // console.log(`Customer ID: ${invoice.customer}`);
    // console.log(`Status: ${invoice.status}`);
    // console.log(`Amount Due: ${invoice.amount_due}`);
    // console.log(`Amount Paid: ${invoice.amount_paid}`);
    // console.log(`Amount Remaining: ${invoice.amount_remaining}`);

    // // Log line items
    // invoice.lines.data.forEach((item) => {
    //   console.log(`\nProduct: ${item.price.product.name}`);
    //   console.log(`Description: ${item.description}`);
    //   console.log(`Quantity: ${item.quantity}`);
    //   console.log(`Unit Amount: ${item.price.unit_amount}`);
    //   console.log(`Total Amount: ${item.amount}`);
    // });

    // const firstItem = invoice.lines.data[0];
    return invoice;
  } catch (error) {
    console.error("Error retrieving invoice details:", error);
    throw error;
  }
}


export async function getOpenCollectiveTransaction(collectiveSlug: string, { createdAt, amount }: { createdAt: Date, amount: number }) {

  const query = gql`
      query getTransactions(
    $collectiveSlug: String!
    $dateFrom: String
    $dateTo: String
    $type: String
    $limit: Int
  ) {
    allTransactions(
      collectiveSlug: $collectiveSlug
      dateFrom: $dateFrom
      dateTo: $dateTo
      type: $type
      limit: $limit
    ) {
      createdAt
      amount
      fromCollective {
        slug
        name
        imageUrl
      }
      ... on Order {
        order {
          createdAt
          totalAmount
        }
      }
    }
  }
    `;

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
    const dateTo = new Date(new Date(createdAt).setSeconds(createdAt.getSeconds() + 30));
    const res: any = await graphQLClient.request(query, {
      collectiveSlug,
      type: "CREDIT",
      dateFrom: createdAt.toISOString(),
      dateTo: dateTo.toISOString()
    });
    if (!res.allTransactions || res.allTransactions.length === 0) return null;
    const transactions = res.allTransactions || [];
    const tx = transactions[transactions.length - 1];
    if (tx.order?.totalAmount === amount) {
      return tx;
    }
    return null;
  } catch (e) {
    console.error(">>> error", e);
    return null
  } finally {
    clearTimeout(timeoutId);
  }

}
  
  

export async function index(providerAccount: string, defaultValues: Partial<Transaction>, cursor?: string): Promise<Transaction[]>  {
  console.log(`stripe: indexing transactions from ${cursor} for ${providerAccount}`);

  const transactions = await getTransactions(cursor ? new Date(cursor) : undefined);

  const txs: Transaction[] = [];
  await Promise.all(transactions.map(async (transaction: any) => {

    const invoice_uuid = uuidV4();
    const tx:Transaction = {
      ...defaultValues,
      provider: "stripe",
      provider_account: providerAccount,
      provider_tx_id: transaction.id,
      account_address: transaction.metadata?.to || process.env.STRIPE_ACCOUNT_NAME || "Stripe",
      counterparty_name: transaction.billing_details?.name,
      counterparty_address: ``,
      type: "TRANSFER",
      description: transaction.description,
      timestamp: new Date(transaction.created * 1000).toISOString(),
      value: transaction.amount,
      token_symbol: transaction.currency.toUpperCase(),
      token_decimals: 2,
      invoice_uuid
    }
    const data:any = {};

    if (tx.account_address.startsWith("https://opencollective.com/")) {
      data.via = "opencollective";
      console.log(">>> tx", JSON.stringify(tx, null, "  "));
      const collectiveSlug = tx.account_address.split("/")[3];
      const ocTransaction = await getOpenCollectiveTransaction(collectiveSlug, { createdAt: new Date(transaction.created * 1000), amount: tx.value});
      console.log(">>> ocTransaction", ocTransaction);
      if (ocTransaction) {
        tx.counterparty_profile = JSON.stringify({
          name: ocTransaction.fromCollective.name,
          url: `https://opencollective.com/${ocTransaction.fromCollective.slug}`,
          imageUrl: ocTransaction.fromCollective.imageUrl,
        });
        tx.counterparty_address = `https://opencollective.com/${ocTransaction.fromCollective.slug}`;
      }
      console.log(">>> transaction", JSON.stringify(tx, null, "  "));
    }

    const balanceTransaction = await stripe.balanceTransactions.retrieve(transaction.balance_transaction);
    for (const fee of balanceTransaction.fee_details) {
      const fee_tx:Transaction = {
        ...tx,
        provider_tx_id: `${transaction.id}-${fee.type}`,
        description: fee.description,
        counterparty_name: applicationName(fee.application),
        counterparty_address: fee.application,
        value: -fee.amount,
        token_symbol: fee.currency.toUpperCase(),
        token_decimals: 2,
        type: "FEE",
        invoice_uuid
      }
      txs.push(fee_tx);
    }
    data.billing_details = transaction.billing_details;
    if (transaction.payment_intent) {
      const details = await getDetailsFromPaymentIntent(
        transaction.payment_intent.toString()
      );
      if (transaction.id === "ch_3Pv21zFAhaWeDyow0AFiEair") {
        console.log(">>> transaction", JSON.stringify(transaction, null, "  "));
        console.log(">>> balanceTransaction", JSON.stringify(balanceTransaction, null, "  "));
        console.log(">>> details", JSON.stringify(details, null, "  "));
      }
      // if (transaction.payment_intent === "pi_3Pm23RFAhaWeDyow04qEjdFH") {
      //   console.log(">>> details", JSON.stringify(details, null, "  "));
      // }
      if (details?.metadata?.description) {
        tx.description = details.metadata?.description || "";
        tx.counterparty_address = details.metadata?.accountAddress;
      } else if (
        details &&
        details.lineItems &&
        details.lineItems.length > 0
      ) {
        const firstItem = details.lineItems[0];
        data.product_id = firstItem?.price?.product.toString();
        data.price_id = firstItem?.price?.id;
        tx.description = firstItem?.description || "";
        data.quantity = firstItem?.quantity || undefined;
        data.unit_price = firstItem?.amount_total || undefined;
      }
    }
    tx.data = JSON.stringify(data);
    txs.push(tx);
  }));
  return txs;
}