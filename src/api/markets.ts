import type { MarketExpand } from '@dimes-dot-fi/sdk';
import { getDimesClient } from './dimesClient';
import type { Market } from './types';

export type MarketSort = 'ticker_asc' | 'depth_desc' | 'discovered_at_desc';

export interface FetchMarketsParams {
  category?: string;
  status?: string;
  acceptingNewPositions?: boolean;
  sort?: MarketSort;
  limit?: number;
  startingAfter?: string;
  endingBefore?: string;
  expand?: string[];
}

export interface FetchMarketsResult {
  data: Market[];
  hasMore: boolean;
  totalCount?: number;
}

export async function fetchMarkets(params?: FetchMarketsParams): Promise<FetchMarketsResult> {
  const page = await getDimesClient().getMarkets({
    category: params?.category,
    status: params?.status,
    acceptingNewPositions: params?.acceptingNewPositions,
    sort: params?.sort ?? 'depth_desc',
    limit: params?.limit,
    startingAfter: params?.startingAfter,
    endingBefore: params?.endingBefore,
    expand: params?.expand as MarketExpand[] | undefined,
  });
  return { data: page.data, hasMore: page.hasMore, totalCount: page.totalCount };
}

export interface SearchMarketsParams {
  query: string;
  category?: string;
  status?: string;
  acceptingNewPositions?: boolean;
}

/** Search markets by title, ticker, or token ID */
export async function searchMarkets(params: SearchMarketsParams): Promise<Market[]> {
  const page = await getDimesClient().searchMarkets({
    query: params.query,
    category: params.category,
    status: params.status,
    acceptingNewPositions: params.acceptingNewPositions,
  });
  return page.data;
}

/** Fetch a single market by ticker */
export async function fetchMarket(ticker: string): Promise<Market> {
  return getDimesClient().getMarket(ticker);
}
