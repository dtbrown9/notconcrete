import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'
import { AdminDashboard } from '../pages/AdminDashboard'

const sitePayload = {
  services: [
    { id: 1, title: 'Construction Cleanup', description: 'Cleanup', category: 'Construction', featured: 1 },
  ],
  testimonials: [
    { id: 1, name: 'Client', role: 'Property Manager', quote: 'Great work', rating: 5 },
  ],
  gallery: [
    {
      id: 1,
      title: 'Construction Final Clean',
      before_label: 'Before',
      after_label: 'After',
      description: 'Final cleanup',
      image_url: '/gallery/furniture-removal-before.jpg',
    },
  ],
  serviceAreas: [
    { id: 1, name: 'Local metro area' },
  ],
}

const feedbackResponse = {
  feedback: [
    {
      id: 1,
      name: 'Test User',
      email: 'test@example.com',
      rating: '5',
      message: 'Great work. Please review this cleanup and keep the crew on the same standard.',
      reviewed: false,
      created_at: '2026-07-01T10:00:00.000Z',
    },
  ],
}

function jsonResponse(payload: unknown, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
    blob: async () => new Blob(),
  } as Response)
}

describe('Feature flows', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    window.history.pushState({}, '', '/')
  })

  it('lets a visitor submit feedback from the homepage', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)

      if (url.includes('/api/site')) {
        return jsonResponse(sitePayload)
      }

      if (url.includes('/api/feedback') && init?.method === 'POST') {
        return jsonResponse({ ok: true })
      }

      return jsonResponse({ ok: true })
    })

    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /tell us how the job went/i })).toBeInTheDocument()
    })

    const feedbackSection = screen.getByRole('heading', { name: /tell us how the job went/i }).closest('section')
    expect(feedbackSection).not.toBeNull()

    const feedbackQueries = within(feedbackSection as HTMLElement)

    const user = userEvent.setup()
    await user.type(feedbackQueries.getByRole('textbox', { name: /your name/i }), 'Test User')
    await user.type(feedbackQueries.getByRole('textbox', { name: /^email$/i }), 'test@example.com')
    await user.type(
      feedbackQueries.getByRole('textbox', { name: /message/i }),
      'Great work. Please review this cleanup and keep the crew on the same standard.'
    )
    await user.click(feedbackQueries.getByRole('button', { name: /send feedback/i }))

    await waitFor(() => {
      expect(screen.getByText(/thanks\. your feedback has been sent for review/i)).toBeInTheDocument()
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/feedback', expect.objectContaining({ method: 'POST' }))
  })

  it('shows the cleanup photos without a slider', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes('/api/site')) {
        return jsonResponse(sitePayload)
      }

      return jsonResponse({ ok: true })
    })

    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /photos from recent cleanup jobs/i })).toBeInTheDocument()
    })

    expect(screen.getByAltText(/furniture removal cleanup/i)).toBeInTheDocument()
    expect(screen.queryByRole('slider')).toBeNull()

    const image = screen.getByAltText(/furniture removal cleanup/i)

    expect(image).toHaveAttribute('src', '/gallery/furniture-removal-before.jpg')
  })

  it('shows submitted feedback in the admin dashboard after login', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const auth = init?.headers as Record<string, string> | undefined

      if (url.includes('/api/admin/setup-status')) {
        return jsonResponse({ isSetup: true })
      }

      if (url.includes('/api/admin/quotes') && auth?.Authorization === 'Bearer secret123') {
        return jsonResponse({ quotes: [] })
      }

      if (url.includes('/api/admin/feedback') && auth?.Authorization === 'Bearer secret123') {
        return jsonResponse(feedbackResponse)
      }

      return jsonResponse({ message: 'Unauthorized' }, false, 401)
    })

    vi.stubGlobal('fetch', fetchMock)

    render(<AdminDashboard />)

    const user = userEvent.setup()

    await waitFor(() => {
      expect(screen.getByLabelText(/admin password/i)).toBeInTheDocument()
    })

    await user.type(screen.getByLabelText(/admin password/i), 'secret123')
    await user.click(screen.getByRole('button', { name: /login/i }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /quote management dashboard/i })).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /customer feedback for review/i })).toBeInTheDocument()
    })

    expect(screen.getByText(/test user/i)).toBeInTheDocument()
    expect(screen.getByText(/great work/i)).toBeInTheDocument()
  })
})