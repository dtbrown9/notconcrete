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

const accountResponse = {
  accountEmail: 'demo.customer@example.com',
  accountName: 'Demo Customer',
  billingPortalUrl: '',
  paypalCheckoutUrl: 'https://www.paypal.com/checkoutnow?token=TESTPAYPAL',
  paymentProcessorReady: true,
  billingPortalReady: true,
  paymentItems: [
    { id: 'pay-1', label: 'Service deposit', status: 'Paid', amount: '$180.00', method: 'Debit card', date: '2026-07-02' },
    { id: 'pay-2', label: 'Invoice balance', status: 'Pending', amount: '$295.00', method: 'Venmo', date: '2026-07-08' },
  ],
  paymentRequests: [
    {
      accountEmail: 'demo.customer@example.com',
      confirmationNumber: 'KC-DEMO123',
      paymentMethod: 'Stripe Checkout',
      amount: '$295.00',
      note: 'Invoice INV-2001',
      status: 'Succeeded',
      adminNote: '',
      createdAt: '2026-07-08T09:00:00.000Z',
      verifiedAt: '2026-07-08T09:10:00.000Z',
      checkoutSessionId: 'cs_demo_123',
      paymentIntentId: 'pi_demo_123',
      processorStatus: 'paid',
      failureReason: '',
      receiptUrl: '',
      amountCents: 29500,
      currency: 'usd',
    },
  ],
  invoiceItems: [
    { id: 'inv-1', number: 'INV-2001', total: '$475.00', status: 'Open' },
    { id: 'inv-2', number: 'INV-1998', total: '$180.00', status: 'Paid' },
  ],
  receiptItems: [
    { id: 'rec-1', label: 'Receipt for service deposit', createdAt: '2026-07-02' },
    { id: 'rec-2', label: 'Receipt for balance payment', createdAt: '2026-07-08' },
  ],
  supportContacts: [
    { label: 'Admin support email', value: 'Tw3y111@aol.com' },
    { label: 'Admin support phone', value: '410-905-9649' },
  ],
  preferences: {
    language: 'English',
    timeZone: 'Eastern Time',
    accessibility: 'High contrast',
  },
  refundStatus: 'No refund requested yet.',
  accountState: 'Active',
  shortcutItems: ['Pay invoice', 'Download receipt', 'Request refund', 'Contact admin', 'Update payment method'],
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
    window.localStorage.clear()
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

  it('renders the homepage shell and quote form correctly', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes('/api/site')) {
        return jsonResponse(sitePayload)
      }

      if (url.includes('/api/quotes')) {
        return jsonResponse({ ok: true })
      }

      return jsonResponse({ ok: true })
    })

    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    await waitFor(() => {
      expect(
        screen.getByRole('heading', {
          name: /a cleaner, simpler way to handle construction cleanup, turnovers, and power washing\./i,
        }),
      ).toBeInTheDocument()
    })

    expect(screen.getByRole('heading', { name: /services grouped by project type/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /tell us what needs to be cleaned/i })).toBeInTheDocument()

    const quoteSection = screen.getByRole('heading', { name: /tell us what needs to be cleaned/i }).closest('section')
    expect(quoteSection).not.toBeNull()

    const quoteQueries = within(quoteSection as HTMLElement)
    const user = userEvent.setup()

    await user.type(quoteQueries.getByRole('textbox', { name: /full name/i }), 'Test Person')
    await user.type(quoteQueries.getByRole('textbox', { name: /phone/i }), '555-111-2222')
    await user.type(quoteQueries.getByRole('textbox', { name: /^email$/i }), 'person@example.com')
    await user.selectOptions(quoteQueries.getByRole('combobox', { name: /service needed/i }), 'Construction Cleanup')
    await user.selectOptions(quoteQueries.getByRole('combobox', { name: /property type/i }), 'Home')
    await user.type(quoteQueries.getByRole('textbox', { name: /address/i }), '123 Main St')
    await user.type(quoteQueries.getByRole('textbox', { name: /preferred date/i }), '2026-07-08')
    await user.type(quoteQueries.getByRole('textbox', { name: /project details/i }), 'Need a full cleanup after the build is done.')
    await user.click(quoteQueries.getByRole('button', { name: /send quote request/i }))

    await waitFor(() => {
      expect(screen.getByText(/thanks\. your request has been saved in the database/i)).toBeInTheDocument()
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/quotes', expect.objectContaining({ method: 'POST' }))
  })

  it('opens the create-account flow from the public homepage and registers a new user', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, string>) : undefined

      if (url.includes('/api/site')) {
        return jsonResponse(sitePayload)
      }

      if (url.includes('/api/account/sign-up') && init?.method === 'POST') {
        expect(body).toMatchObject({
          displayName: 'New Customer',
          email: 'new.customer@example.com',
          password: 'newcustomer123',
          confirmPassword: 'newcustomer123',
        })

        return jsonResponse({ ok: true, token: 'session-token-123', accountEmail: 'new.customer@example.com', accountName: 'New Customer' }, true, 201)
      }

      if (url.includes('/api/account/me')) {
        return jsonResponse({
          ...accountResponse,
          accountEmail: 'new.customer@example.com',
          accountName: 'New Customer',
          paymentRequests: [],
        })
      }

      return jsonResponse({ message: 'Unexpected request' }, false, 500)
    })

    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)

    window.history.pushState({}, '', '/account?mode=create')
    render(<App />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /create your account to save payment details and access the portal/i })).toBeInTheDocument()
    })

    await userEvent.setup().type(screen.getByRole('textbox', { name: /display name/i }), 'New Customer')
    await userEvent.setup().type(screen.getByRole('textbox', { name: /account email/i }), 'new.customer@example.com')
    await userEvent.setup().type(screen.getByLabelText(/^password$/i), 'newcustomer123')
    await userEvent.setup().type(screen.getByLabelText(/^confirm password$/i), 'newcustomer123')
    await userEvent.setup().click(screen.getByRole('button', { name: /^create account$/i }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /welcome to your account, new customer/i })).toBeInTheDocument()
    })
  })

  it('renders the account dashboard route with secure checkout and return status', async () => {
    let currentPassword = 'demo123'
    const openMock = vi.fn()
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const authHeader = init?.headers as Record<string, string> | undefined
      const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, string>) : undefined

      if (url.includes('/api/account/sign-in') && init?.method === 'POST') {
        if (body?.email === 'demo.customer@example.com' && body?.password === currentPassword) {
          return jsonResponse({ ok: true, token: 'session-token-123', accountEmail: 'demo.customer@example.com' })
        }

        return jsonResponse({ message: 'Invalid email or password' }, false, 401)
      }

      if (url.includes('/api/account/me') && authHeader?.Authorization === 'Bearer session-token-123') {
        return jsonResponse(accountResponse)
      }

      if (url.includes('/api/account/payments/session/cs_test_123') && authHeader?.Authorization === 'Bearer session-token-123') {
        return jsonResponse({
          payment: {
            accountEmail: 'demo.customer@example.com',
            confirmationNumber: 'KC-ABC12345',
            paymentMethod: 'Stripe Checkout',
            amount: '$240.00',
            note: 'Invoice INV-1042',
            status: 'Succeeded',
            adminNote: '',
            createdAt: '2026-07-08T12:00:00.000Z',
            verifiedAt: '2026-07-08T12:01:00.000Z',
            checkoutSessionId: 'cs_test_123',
            paymentIntentId: 'pi_test_123',
            processorStatus: 'paid',
            failureReason: '',
            receiptUrl: '',
            amountCents: 24000,
            currency: 'usd',
          },
        })
      }

      if (url.includes('/api/account/payments/checkout-session') && init?.method === 'POST') {
        if (authHeader?.Authorization !== 'Bearer session-token-123') {
          return jsonResponse({ message: 'Unauthorized' }, false, 401)
        }

        return jsonResponse(
          {
            ok: true,
            payment: {
              checkoutSessionId: 'cs_test_123',
              checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_test_123',
            },
          },
          true,
          201,
        )
      }

      if (url.includes('/api/account/billing-portal/session') && init?.method === 'POST') {
        if (authHeader?.Authorization !== 'Bearer session-token-123') {
          return jsonResponse({ message: 'Unauthorized' }, false, 401)
        }

        return jsonResponse({ ok: true, url: 'https://billing.stripe.com/p/session/test_123' }, true, 201)
      }

      if (url.includes('/api/account/password') && init?.method === 'PATCH') {
        if (authHeader?.Authorization !== 'Bearer session-token-123') {
          return jsonResponse({ message: 'Unauthorized' }, false, 401)
        }

        if (body?.currentPassword !== currentPassword) {
          return jsonResponse({ message: 'Current password is incorrect' }, false, 401)
        }

        currentPassword = body?.newPassword || currentPassword
        return jsonResponse({ ok: true })
      }

      if (url.includes('/api/account/refunds') && init?.method === 'POST') {
        return jsonResponse({ ok: true, refundStatus: 'Under review' }, true, 201)
      }

      if (url.includes('/api/account/sign-out') && init?.method === 'POST') {
        return jsonResponse({ ok: true })
      }

      if (url.includes('/api/site')) {
        return jsonResponse(sitePayload)
      }

      return jsonResponse({ ok: true })
    })

    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('open', openMock)
    window.history.pushState({}, '', '/account?checkout_session_id=cs_test_123&checkout_result=success')

    render(<App />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /sign in to load your customer record/i })).toBeInTheDocument()
    })

    const accountAccessSection = screen.getByRole('heading', { name: /sign in to load your customer record/i }).closest('section')
    expect(accountAccessSection).not.toBeNull()

    const accountAccessQueries = within(accountAccessSection as HTMLElement)
    const user = userEvent.setup()
    await user.clear(accountAccessQueries.getByRole('textbox', { name: /account email/i }))
    await user.type(accountAccessQueries.getByRole('textbox', { name: /account email/i }), 'demo.customer@example.com')
    await user.clear(accountAccessQueries.getByLabelText(/^password$/i))
    await user.type(accountAccessQueries.getByLabelText(/^password$/i), 'demo123')
    await user.click(accountAccessQueries.getByRole('button', { name: /^sign in$/i }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /welcome to your account, demo customer/i })).toBeInTheDocument()
    })

    expect(screen.getByRole('heading', { name: /create an account or sign in to load your customer record/i })).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText(/payment successful/i)).toBeInTheDocument()
    })

    expect(screen.getByRole('heading', { name: /shortcuts to the most common account tasks/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: /invoice history/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: /receipt downloads/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: /payment methods/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: /secure checkout/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: /support and refund request/i })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /request refund/i })).toHaveLength(2)
    expect(screen.getByRole('button', { name: /deactivate account/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /delete account/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /manage payment methods/i })).toBeInTheDocument()

    const invoiceSection = screen.getByRole('heading', { level: 3, name: /invoice history/i }).closest('section')
    expect(invoiceSection).not.toBeNull()

    const invoiceQueries = within(invoiceSection as HTMLElement)
    expect(invoiceQueries.getAllByRole('button', { name: /view/i })).toHaveLength(2)
    expect(invoiceQueries.getAllByRole('button', { name: /download/i })).toHaveLength(4)

    const paymentRequestSection = screen.getByRole('heading', { level: 3, name: /secure checkout/i }).closest('section')
    expect(paymentRequestSection).not.toBeNull()

    const paymentQueries = within(paymentRequestSection as HTMLElement)
    const supportedMethods = paymentQueries.getByLabelText(/supported payment methods/i)
    const supportedMethodsQueries = within(supportedMethods)
    for (const method of ['Debit card', 'Credit card', 'ACH Transfer', 'Apple Pay', 'Google Pay']) {
      expect(supportedMethodsQueries.getByText(method)).toBeInTheDocument()
    }

    expect(paymentQueries.getByRole('link', { name: /pay with paypal/i })).toHaveAttribute('href', 'https://www.paypal.com/checkoutnow?token=TESTPAYPAL')

    await user.click(screen.getByRole('button', { name: /manage payment methods/i }))

    await waitFor(() => {
      expect(openMock).toHaveBeenCalledWith('https://billing.stripe.com/p/session/test_123', '_self', 'noopener')
    })

    await user.type(paymentQueries.getByRole('textbox', { name: /amount/i }), '$240.00')
    await user.type(paymentQueries.getByRole('textbox', { name: /note/i }), 'Invoice INV-1042')
    await user.click(paymentQueries.getByRole('button', { name: /start secure checkout/i }))

    await waitFor(() => {
      expect(openMock).toHaveBeenCalledWith('https://checkout.stripe.com/c/pay/cs_test_123', '_self', 'noopener')
    })

    expect(screen.getByText(/online payments require a customer account/i)).toBeInTheDocument()

    const requestRefundButtons = screen.getAllByRole('button', { name: /request refund/i })
    expect(requestRefundButtons).toHaveLength(2)
    const refundSection = screen.getByRole('heading', { name: /support and refund request/i }).closest('section')
    expect(refundSection).not.toBeNull()

    const refundQueries = within(refundSection as HTMLElement)
    await user.type(refundQueries.getByRole('textbox', { name: /refund reason/i }), 'Service was not completed as expected.')
    await user.click(requestRefundButtons[1])
    expect(fetchMock).toHaveBeenCalledWith('/api/account/refunds', expect.objectContaining({ method: 'POST' }))

    const passwordSection = screen.getByRole('heading', { name: /password change/i }).closest('section')
    expect(passwordSection).not.toBeNull()

    const passwordQueries = within(passwordSection as HTMLElement)
    await user.type(passwordQueries.getByLabelText(/^current password$/i), 'demo123')
    await user.type(passwordQueries.getByLabelText(/^new password$/i), 'demo456')
    await user.type(passwordQueries.getByLabelText(/^confirm new password$/i), 'demo456')
    await user.click(passwordQueries.getByRole('button', { name: /update password/i }))

    await waitFor(() => {
      expect(screen.getByText(/password updated successfully/i)).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /sign out/i }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /a cleaner, simpler way to handle construction cleanup, turnovers, and power washing/i })).toBeInTheDocument()
    })
    expect(window.localStorage.getItem('accountSessionToken')).toBeNull()

    const signedOutHero = screen.getByRole('heading', { name: /a cleaner, simpler way to handle construction cleanup, turnovers, and power washing/i }).closest('header')
    expect(signedOutHero).not.toBeNull()

    const signedOutAccessQueries = within(signedOutHero as HTMLElement)
    expect(signedOutAccessQueries.getByRole('link', { name: /get a free quote/i })).toBeInTheDocument()
  })

  it('opens and downloads invoice summaries from invoice history', async () => {
    const openMock = vi.fn()
    const anchorClickMock = vi.fn()
    const createObjectUrlMock = vi.fn(() => 'blob:test-invoice')
    const revokeObjectUrlMock = vi.fn()
    const originalCreateObjectURL = window.URL.createObjectURL
    const originalRevokeObjectURL = window.URL.revokeObjectURL
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const element = document.createElementNS('http://www.w3.org/1999/xhtml', tagName) as HTMLElement

      if (tagName.toLowerCase() === 'a') {
        Object.defineProperty(element, 'click', {
          configurable: true,
          value: anchorClickMock,
        })
      }

      return element
    })

    vi.stubGlobal('open', openMock)
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const authHeader = init?.headers as Record<string, string> | undefined

      if (url.includes('/api/account/sign-in') && init?.method === 'POST') {
        return jsonResponse({ ok: true, token: 'session-token-123', accountEmail: 'demo.customer@example.com' })
      }

      if (url.includes('/api/account/me') && authHeader?.Authorization === 'Bearer session-token-123') {
        return jsonResponse(accountResponse)
      }

      if (url.includes('/api/site')) {
        return jsonResponse(sitePayload)
      }

      return jsonResponse({ ok: true })
    }) as typeof fetch)

    Object.defineProperty(window.URL, 'createObjectURL', { configurable: true, value: createObjectUrlMock })
    Object.defineProperty(window.URL, 'revokeObjectURL', { configurable: true, value: revokeObjectUrlMock })

    window.history.pushState({}, '', '/account')
    render(<App />)

    const user = userEvent.setup()

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /sign in to load your customer record/i })).toBeInTheDocument()
    })

    await user.type(screen.getByRole('textbox', { name: /account email/i }), 'demo.customer@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'demo123')
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /welcome to your account, demo customer/i })).toBeInTheDocument()
    })

    const invoiceSection = screen.getByRole('heading', { level: 3, name: /invoice history/i }).closest('section')
    expect(invoiceSection).not.toBeNull()
    const invoiceQueries = within(invoiceSection as HTMLElement)

    await user.click(invoiceQueries.getAllByRole('button', { name: /view/i })[0])
    expect(openMock).toHaveBeenCalledWith('blob:test-invoice', '_blank', 'noopener')

    await user.click(invoiceQueries.getAllByRole('button', { name: /download/i })[0])
    expect(anchorClickMock).toHaveBeenCalled()
    expect(createObjectUrlMock).toHaveBeenCalled()
    expect(revokeObjectUrlMock).toHaveBeenCalledWith('blob:test-invoice')

    createElementSpy.mockRestore()
    Object.defineProperty(window.URL, 'createObjectURL', { configurable: true, value: originalCreateObjectURL })
    Object.defineProperty(window.URL, 'revokeObjectURL', { configurable: true, value: originalRevokeObjectURL })
  })

  it('shows a clear message when billing portal management is unavailable', async () => {
    const unavailableAccountResponse = {
      ...accountResponse,
      billingPortalReady: false,
    }

    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const authHeader = init?.headers as Record<string, string> | undefined

      if (url.includes('/api/account/sign-in') && init?.method === 'POST') {
        return jsonResponse({ ok: true, token: 'session-token-123', accountEmail: 'demo.customer@example.com' })
      }

      if (url.includes('/api/account/me') && authHeader?.Authorization === 'Bearer session-token-123') {
        return jsonResponse(unavailableAccountResponse)
      }

      if (url.includes('/api/site')) {
        return jsonResponse(sitePayload)
      }

      return jsonResponse({ ok: true })
    }) as typeof fetch)

    window.history.pushState({}, '', '/account')
    render(<App />)
    const user = userEvent.setup()

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /sign in to load your customer record/i })).toBeInTheDocument()
    })

    await user.type(screen.getByRole('textbox', { name: /account email/i }), 'demo.customer@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'demo123')
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /welcome to your account, demo customer/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /manage payment methods/i }))

    expect(screen.getByText(/payment-method management is not configured on this server yet/i)).toBeInTheDocument()
  })

  it('wires quick action shortcuts to working account actions', async () => {
    const openMock = vi.fn()

    vi.stubGlobal('open', openMock)
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const authHeader = init?.headers as Record<string, string> | undefined

      if (url.includes('/api/account/sign-in') && init?.method === 'POST') {
        return jsonResponse({ ok: true, token: 'session-token-123', accountEmail: 'demo.customer@example.com' })
      }

      if (url.includes('/api/account/me') && authHeader?.Authorization === 'Bearer session-token-123') {
        return jsonResponse(accountResponse)
      }

      if (url.includes('/api/account/billing-portal/session') && init?.method === 'POST') {
        return jsonResponse({ ok: true, url: 'https://billing.stripe.com/p/session/test_123' }, true, 201)
      }

      if (url.includes('/api/site')) {
        return jsonResponse(sitePayload)
      }

      return jsonResponse({ ok: true })
    }) as typeof fetch)

    window.history.pushState({}, '', '/account')
    render(<App />)
    const user = userEvent.setup()

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /sign in to load your customer record/i })).toBeInTheDocument()
    })

    await user.type(screen.getByRole('textbox', { name: /account email/i }), 'demo.customer@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'demo123')
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /welcome to your account, demo customer/i })).toBeInTheDocument()
    })

    const quickActionsSection = screen.getByRole('heading', { name: /shortcuts to the most common account tasks/i }).closest('section')
    expect(quickActionsSection).not.toBeNull()
    const quickActionQueries = within(quickActionsSection as HTMLElement)

    await user.click(quickActionQueries.getByRole('button', { name: /pay invoice/i }))
    expect(screen.getByRole('textbox', { name: /amount/i })).toHaveFocus()

    await user.click(quickActionQueries.getByRole('button', { name: /request refund/i }))
    expect(screen.getByRole('textbox', { name: /refund reason/i })).toHaveFocus()

    await user.click(quickActionQueries.getByRole('button', { name: /update payment method/i }))

    await waitFor(() => {
      expect(openMock).toHaveBeenCalledWith('https://billing.stripe.com/p/session/test_123', '_self', 'noopener')
    })
  })
})