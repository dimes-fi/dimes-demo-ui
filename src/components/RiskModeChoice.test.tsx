import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RiskModeChoice } from './RiskModeChoice'
import type { CommittedPlan } from './RiskModeRail'

const quotedPlan: CommittedPlan = {
  liquidationPriceUsd: '0.2800',
  steps: [
    { triggerPriceUsd: '0.4200', targetLeverageBps: 21000 },
    { triggerPriceUsd: '0.3600', targetLeverageBps: 15000 },
  ],
}

function renderChoice(props: Partial<Parameters<typeof RiskModeChoice>[0]> = {}) {
  const onChange = vi.fn()
  const rendered = render(
    <RiskModeChoice
      value="adaptive"
      marginUsdcUnits="67000000"
      isCommittedOffered
      entryPriceUsd="0.5200"
      entryLeverageBps={25000}
      adaptiveLiquidationPriceUsd="0.3100"
      committedPlan={quotedPlan}
      onChange={onChange}
      {...props}
    />,
  )
  return { onChange, ...rendered }
}

function cards(): HTMLElement[] {
  return screen.getAllByRole('radio').map((radio) => radio.closest('label') as HTMLElement)
}

describe('RiskModeChoice', () => {
  it('offers each mode as one selectable card carrying its own ladder', () => {
    const { container } = renderChoice()

    const [adaptiveCard, committedCard] = cards()
    expect(within(adaptiveCard).getByText('No deposit')).toBeInTheDocument()
    expect(within(adaptiveCard).getByText('ADAPTIVE')).toBeInTheDocument()
    expect(within(committedCard).getByText('+ $67.00 refundable deposit')).toBeInTheDocument()
    expect(within(committedCard).getByText('COMMITTED')).toBeInTheDocument()
    expect(container.querySelectorAll('svg').length).toBe(2)
  })

  it('draws the quoted ladder in the committed card', () => {
    renderChoice()

    const [, committedCard] = cards()
    expect(within(committedCard).getByText('42¢')).toBeInTheDocument()
    expect(within(committedCard).getByText('28¢')).toBeInTheDocument()
  })

  it('selects a mode when the card is clicked anywhere', () => {
    const { onChange } = renderChoice()

    const [, committedCard] = cards()
    fireEvent.click(within(committedCard).getByText('COMMITTED'))
    expect(onChange).toHaveBeenCalledWith('committed')
  })

  it('marks the picked mode as the checked radio', () => {
    renderChoice({ value: 'committed' })

    const [adaptive, committed] = screen.getAllByRole('radio') as HTMLInputElement[]
    expect(adaptive.checked).toBe(false)
    expect(committed.checked).toBe(true)
  })

  it('greys out and disables the committed card when the quote does not offer it', () => {
    const { onChange } = renderChoice({
      isCommittedOffered: false,
      marginUsdcUnits: null,
      committedPlan: null,
      unavailableMessage: 'Not offered on crypto markets.',
    })

    const [, committedCard] = cards()
    const committedRadio = within(committedCard).getByRole('radio') as HTMLInputElement
    expect(committedRadio.disabled).toBe(true)
    expect(Number(committedCard.style.opacity)).toBeLessThan(1)
    expect(within(committedCard).getByText(/Not offered on crypto markets\./)).toBeInTheDocument()

    fireEvent.click(within(committedCard).getByText('COMMITTED'))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('shows an unlabelled example ladder rather than an empty card when unavailable', () => {
    renderChoice({ isCommittedOffered: false, marginUsdcUnits: null, committedPlan: null })

    const [, committedCard] = cards()
    const svgText = Array.from(committedCard.querySelectorAll('text')).map((n) => n.textContent ?? '')
    expect(svgText).toContain('COMMITTED')
    expect(svgText.some((text) => text.includes('¢'))).toBe(false)
    expect(svgText.some((text) => /\dx/.test(text))).toBe(false)
    expect(committedCard.querySelector('[class*="drift"]')).toBeNull()
  })

  it('points a screen reader at the reason the committed card is disabled', () => {
    renderChoice({
      isCommittedOffered: false,
      marginUsdcUnits: null,
      committedPlan: null,
      unavailableMessage: 'Not offered late in a soccer match.',
    })

    const [, committedCard] = cards()
    const committedRadio = within(committedCard).getByRole('radio')
    const describedBy = committedRadio.getAttribute('aria-describedby')
    expect(describedBy).not.toBeNull()
    expect(document.getElementById(describedBy!)?.textContent).toContain(
      'Not offered late in a soccer match.',
    )
  })
})
