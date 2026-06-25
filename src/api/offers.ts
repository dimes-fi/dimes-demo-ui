import { getDimesClient } from './dimesClient';
import type { CreateOfferParams, Offer } from './types';

/** Create an offer (quote) for a leveraged position. */
export async function createOffer(params: CreateOfferParams): Promise<Offer> {
  return getDimesClient().createQuote(params);
}

/** Create a draft quote — same pricing/fees but no signature or expiry pressure. */
export async function createDraftQuote(params: CreateOfferParams): Promise<Offer> {
  return getDimesClient().createDraftQuote(params);
}

/** Promote a draft quote into a fully signed quote ready for on-chain execution. */
export async function promoteDraftQuote(draftQuoteId: string): Promise<Offer> {
  return getDimesClient().promoteDraftQuote(draftQuoteId);
}
