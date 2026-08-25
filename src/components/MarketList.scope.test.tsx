import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MarketList } from './MarketList'
import { useMarkets } from '../hooks/useMarkets'

vi.mock('../hooks/useMarkets', () => ({ useMarkets: vi.fn() }))

function renderMarketList() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MarketList onSelectMarket={vi.fn()} />
    </QueryClientProvider>,
  )
}

/** The scope argument is the 7th parameter of useMarkets. */
function lastScopeArg() {
  const calls = vi.mocked(useMarkets).mock.calls
  return calls[calls.length - 1]?.[6]
}

describe('MarketList advanced scope filter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.history.replaceState(null, '', '/')
    vi.mocked(useMarkets).mockReturnValue({
      data: { data: [], hasMore: false },
      isLoading: false,
      isFetching: false,
    } as unknown as ReturnType<typeof useMarkets>)
  })

  it('keeps the advanced filter collapsed by default and sends no scope', () => {
    renderMarketList()

    expect(screen.getByRole('button', { name: /advanced/i })).toBeInTheDocument()
    expect(screen.queryByLabelText('Event ticker')).not.toBeInTheDocument()
    expect(lastScopeArg()).toBeUndefined()
  })

  it('reveals the event and series inputs when expanded', () => {
    renderMarketList()

    fireEvent.click(screen.getByRole('button', { name: /advanced/i }))

    expect(screen.getByLabelText('Event ticker')).toBeInTheDocument()
    expect(screen.getByLabelText('Filter markets by event or series')).toBeInTheDocument()
  })

  it('scopes the query to an event once a ticker is typed', async () => {
    renderMarketList()
    fireEvent.click(screen.getByRole('button', { name: /advanced/i }))

    fireEvent.change(screen.getByLabelText('Event ticker'), {
      target: { value: 'btc-updown-5m-1786109700' },
    })

    await waitFor(() => {
      expect(lastScopeArg()).toEqual({ kind: 'event', ticker: 'btc-updown-5m-1786109700' })
    })
  })

  it('scopes the query to a series when the series option is chosen', async () => {
    renderMarketList()
    fireEvent.click(screen.getByRole('button', { name: /advanced/i }))

    fireEvent.change(screen.getByLabelText('Filter markets by event or series'), {
      target: { value: 'series' },
    })
    fireEvent.change(screen.getByLabelText('Series ticker'), {
      target: { value: 'btc-up-or-down-5m' },
    })

    await waitFor(() => {
      expect(lastScopeArg()).toEqual({ kind: 'series', ticker: 'btc-up-or-down-5m' })
    })
  })

  it('scopes to a market’s event when its event chip is clicked', async () => {
    vi.mocked(useMarkets).mockReturnValue({
      data: {
        data: [
          {
            id: 'dm_mkt_1',
            ticker: 'LAL-BOS-ML',
            title: 'Lakers vs Celtics — moneyline',
            category: 'sport',
            status: 'active',
            acceptingNewPositions: true,
            leverage: { maxYesBps: 50000, maxNoBps: 50000, maxBps: 50000, minBps: 20000, stepBps: 1000 },
            sidedEligibility: {
              yes: { acceptingNewPositions: true, rejectionReasonCode: null },
              no: { acceptingNewPositions: true, rejectionReasonCode: null },
            },
            event: { ticker: 'nba-lal-bos-2026-08-06', title: 'Lakers vs Celtics', seriesTicker: 'nba' },
          },
        ],
        hasMore: false,
      },
      isLoading: false,
      isFetching: false,
    } as unknown as ReturnType<typeof useMarkets>)

    renderMarketList()

    fireEvent.click(screen.getByRole('button', { name: 'Lakers vs Celtics' }))

    await waitFor(() => {
      expect(lastScopeArg()).toEqual({ kind: 'event', ticker: 'nba-lal-bos-2026-08-06' })
    })
  })

  it('restores the scope from the url so a filtered view can be shared', () => {
    window.history.replaceState(null, '', '/?series=btc-up-or-down-5m')

    renderMarketList()

    expect(lastScopeArg()).toEqual({ kind: 'series', ticker: 'btc-up-or-down-5m' })
    expect(screen.getByLabelText('Series ticker')).toBeInTheDocument()
  })
})
