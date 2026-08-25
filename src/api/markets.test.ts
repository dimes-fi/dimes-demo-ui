import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchMarkets, searchMarkets } from './markets'
import { getDimesClient } from './dimesClient'

vi.mock('./dimesClient', () => ({ getDimesClient: vi.fn() }))

const emptyPage = { data: [], hasMore: false, totalCount: 0 }

function mockClient() {
  const client = {
    getMarkets: vi.fn().mockResolvedValue(emptyPage),
    getEventMarkets: vi.fn().mockResolvedValue(emptyPage),
    getSeriesMarkets: vi.fn().mockResolvedValue(emptyPage),
  }
  vi.mocked(getDimesClient).mockReturnValue(client as unknown as ReturnType<typeof getDimesClient>)
  return client
}

describe('fetchMarkets', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls the flat market list when no scope is set', async () => {
    const client = mockClient()

    await fetchMarkets({ category: 'sport' })

    expect(client.getMarkets).toHaveBeenCalledOnce()
    expect(client.getEventMarkets).not.toHaveBeenCalled()
    expect(client.getSeriesMarkets).not.toHaveBeenCalled()
  })

  it('calls the event-scoped list and forwards the other filters', async () => {
    const client = mockClient()

    await fetchMarkets({ category: 'sport', scope: { kind: 'event', ticker: 'evt-1' } })

    expect(client.getMarkets).not.toHaveBeenCalled()
    expect(client.getEventMarkets).toHaveBeenCalledWith(
      'evt-1',
      expect.objectContaining({ category: 'sport' }),
    )
  })

  it('calls the series-scoped list', async () => {
    const client = mockClient()

    await fetchMarkets({ scope: { kind: 'series', ticker: 'btc-up-or-down-5m' } })

    expect(client.getSeriesMarkets).toHaveBeenCalledWith('btc-up-or-down-5m', expect.anything())
    expect(client.getMarkets).not.toHaveBeenCalled()
  })
})

describe('searchMarkets', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('keeps a free-text search inside the event scope', async () => {
    const client = mockClient()

    await searchMarkets({ query: 'lakers', scope: { kind: 'event', ticker: 'evt-1' } })

    expect(client.getEventMarkets).toHaveBeenCalledWith(
      'evt-1',
      expect.objectContaining({ query: 'lakers' }),
    )
    expect(client.getMarkets).not.toHaveBeenCalled()
  })

  it('searches across all markets when no scope is set', async () => {
    const client = mockClient()

    await searchMarkets({ query: 'lakers' })

    expect(client.getMarkets).toHaveBeenCalledWith(expect.objectContaining({ query: 'lakers' }))
  })
})
