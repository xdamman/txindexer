# TX INDEXER

Index transactions from stripe, blockchain and regular bank accounts to a local sqlite db

## Problem

We are running a fiscal host that has different projects / collectives.

- They all share a single Stripe account and two bank accounts (WISE and KBC).
- They each have their own multisig and other hot wallets and have tokens on different chains.
- They use open collective to manage their expenses.

How do we make sense of that?

## Solution

The goal of this indexer is to start aggregating all transactions in a single local sqlite db.

**This is still a work in progress**

First priority is to provide a consolidated view for the fiscal host and the accountant.

Features that we need:

- Define rules to allocate each transaction to the right collective
- Attach receipts / invoices to each transaction for the accountants
