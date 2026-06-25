import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PartialCloseSlider } from './PartialCloseSlider'

function renderSlider(value: bigint, onChange = vi.fn()) {
  render(
    <PartialCloseSlider
      currentTokenUnits={10_000_000n}
      minTokenUnits={2_000_000n}
      maxTokenUnits={10_000_000n}
      positionValueUsdPips="30000"
      value={value}
      onChange={onChange}
    />,
  )
  return onChange
}

describe('PartialCloseSlider', () => {
  it('renders the resolved token amount, headline %, USD estimate, and bounds', () => {
    renderSlider(5_000_000n)

    expect(screen.getByText('Amount to close')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()
    expect(screen.getByText('5.00 tokens')).toBeInTheDocument()
    expect(screen.getByText('≈ $1.50')).toBeInTheDocument()
    expect(screen.getByText('min 2.00')).toBeInTheDocument()
    expect(screen.getByText('max 10.00')).toBeInTheDocument()
  })

  it('configures the range input against the partial-close bounds in bps', () => {
    renderSlider(5_000_000n)

    const slider = screen.getByRole('slider') as HTMLInputElement
    expect(slider.min).toBe('2000')
    expect(slider.max).toBe('10000')
    expect(slider.value).toBe('5000')
  })

  it('reports a snapped, clamped bigint of token units on change', () => {
    const onChange = renderSlider(5_000_000n)
    const slider = screen.getByRole('slider')

    fireEvent.change(slider, { target: { value: '8000' } })
    expect(onChange).toHaveBeenCalledWith(8_000_000n)

    fireEvent.change(slider, { target: { value: '3000' } })
    expect(onChange).toHaveBeenLastCalledWith(3_000_000n)
  })

  it('clamps a drag past the max down to the maximum slice', () => {
    const onChange = renderSlider(5_000_000n)
    const slider = screen.getByRole('slider')

    fireEvent.change(slider, { target: { value: '10000' } })
    expect(onChange).toHaveBeenCalledWith(10_000_000n)
  })
})
