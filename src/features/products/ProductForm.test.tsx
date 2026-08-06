import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProductForm } from './ProductForm'

vi.mock('./api', () => ({
  fetchCategories: vi.fn(async () => [{ id: 1, name: 'Nabiał' }]),
  createProduct: vi.fn(),
}))

describe('ProductForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('pokazuje błąd gdy nazwa jest pusta', async () => {
    const user = userEvent.setup()
    render(<ProductForm />)

    await screen.findByRole('option', { name: 'Nabiał' })

    await user.click(screen.getByRole('button', { name: 'Zapisz produkt' }))

    expect(screen.getByText('Podaj nazwę produktu.')).toBeInTheDocument()
  })
})
