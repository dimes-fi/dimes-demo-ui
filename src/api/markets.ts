import type { MarketExpand } from '@dimes-dot-fi/sdk';
import { getDimesClient } from './dimesClient';
import type { Market } from './types';

export type MarketSort = 'ticker_asc' | 'depth_desc' | 'discovered_at_desc';

/**
 * Narrows a market listing to one parent. An event is a single real-world happening (one game, one
 * hourly price window); a series is the recurring template those events come from. Read the tickers
 * from a market's `event.ticker` / `event.series_ticker`.
 */
export type MarketScopeKind = 'event' | 'series';

export interface MarketScope {
  kind: MarketScopeKind;
  ticker: string;
}

export interface FetchMarketsParams {
  category?: string;
  status?: string;
  acceptingNewPositions?: boolean;
  sort?: MarketSort;
  limit?: number;
  startingAfter?: string;
  endingBefore?: string;
  expand?: string[];
  scope?: MarketScope;
}

export interface FetchMarketsResult {
  data: Market[];
  hasMore: boolean;
  totalCount?: number;
}

export async function fetchMarkets(params?: FetchMarketsParams): Promise<FetchMarketsResult> {
  const client = getDimesClient();
  const query = {
    category: params?.category,
    status: params?.status,
    acceptingNewPositions: params?.acceptingNewPositions,
    sort: params?.sort ?? 'depth_desc',
    limit: params?.limit,
    startingAfter: params?.startingAfter,
    endingBefore: params?.endingBefore,
    expand: params?.expand as MarketExpand[] | undefined,
  };

  const scope = params?.scope;
  const page = scope
    ? scope.kind === 'event'
      ? await client.getEventMarkets(scope.ticker, query)
      : await client.getSeriesMarkets(scope.ticker, query)
    : await client.getMarkets(query);

  return { data: page.data, hasMore: page.hasMore, totalCount: page.totalCount };
}

export interface SearchMarketsParams {
  query: string;
  category?: string;
  status?: string;
  acceptingNewPositions?: boolean;
  scope?: MarketScope;
}

/** Search markets by title, ticker, or token ID. Stays inside the parent scope when one is set. */
export async function searchMarkets(params: SearchMarketsParams): Promise<Market[]> {
  const client = getDimesClient();
  const query = {
    query: params.query,
    category: params.category,
    status: params.status,
    acceptingNewPositions: params.acceptingNewPositions,
  };

  const scope = params.scope;
  const page = scope
    ? scope.kind === 'event'
      ? await client.getEventMarkets(scope.ticker, query)
      : await client.getSeriesMarkets(scope.ticker, query)
    : await client.getMarkets(query);

  return page.data;
}

/** Fetch a single market by ticker */
export async function fetchMarket(ticker: string): Promise<Market> {
  return getDimesClient().getMarket(ticker);
}
