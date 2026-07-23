import { useEffect, useLayoutEffect, useMemo, useState } from 'react'

type PaymentItem = {
  id: string
  label: string
  status: 'Paid' | 'Pending' | 'Overdue'
  amount: string
  method: string
  date: string
}

type InvoiceItem = {
  id: string
  number: string
  total: string
  status: 'Open' | 'Paid' | 'Refund requested'
}

type RefundStatus = {
  id: number
  reason: string
  status: string
  admin_note: string
  created_at: string
  updated_at: string
}

type ReceiptItem = {
  id: string
  label: string
  createdAt: string
}

type PaymentRequest = {
  accountEmail: string
  confirmationNumber: string
  paymentMethod: string
  amount: string
  note: string
  status: string
  adminNote: string
  createdAt: string
  verifiedAt: string
  checkoutSessionId: string
  paymentIntentId: string
  processorStatus: string
  failureReason: string
  receiptUrl: string
  amountCents: number
  currency: string
}

type AccountApiPayload = {
  accountEmail: string
  accountName: string
  billingPortalUrl: string
  paypalCheckoutUrl: string
  paymentProcessorReady: boolean
  billingPortalReady: boolean
  paymentItems: PaymentItem[]
  paymentRequests: PaymentRequest[]
  invoiceItems: InvoiceItem[]
  receiptItems: ReceiptItem[]
  supportContacts: Array<{ label: string; value: string }>
  preferences: {
    language: string
    timeZone: string
    accessibility: string
  }
  refundStatus: string
  accountState: string
  shortcutItems: string[]
}

type AccountSessionResponse = {
  ok: boolean
  token: string
  accountEmail: string
}

type AccountSignupResponse = AccountSessionResponse & {
  accountName: string
}

type BillingPortalSessionResponse = {
  ok: boolean
  url: string
}

const defaultPaymentItems: PaymentItem[] = []

const defaultInvoiceItems: InvoiceItem[] = []

const defaultReceiptItems: ReceiptItem[] = [
  { id: 'rec-1', label: 'Receipt for service deposit', createdAt: '2026-07-01' },
  { id: 'rec-2', label: 'Receipt for pressure washing', createdAt: '2026-06-20' },
]

const paymentHighlights = ['Debit card', 'Credit card', 'ACH Transfer', 'Apple Pay', 'Google Pay', 'Cash App', 'Amazon Pay']

const defaultShortcutItems = ['Pay invoice', 'Request refund', 'Contact admin', 'Update payment method']

const defaultSupportContacts = [
  { label: 'Admin support email', value: 'Tw3y111@aol.com' },
  { label: 'Admin support phone', value: '410-905-9649' },
  { label: 'Owner contact email', value: 'Winfield.raekwon@yahoo.com' },
]

const downloadTextFile = (filename: string, contents: string) => {
  const blob = new Blob([contents], { type: 'text/plain;charset=utf-8' })
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.URL.revokeObjectURL(url)
}

const downloadInvoiceSummary = (invoice: InvoiceItem & { url?: string }) => {
  if (invoice.url) {
    // For Stripe invoices with PDF URL, open the PDF in a new tab
    window.open(invoice.url, '_blank', 'noopener')
  } else {
    // Fallback for non-Stripe invoices
    downloadTextFile(`${invoice.number}.txt`, `Invoice ${invoice.number}\nTotal: ${invoice.total}\nStatus: ${invoice.status}`)
  }
}

const viewInvoiceSummary = (invoice: InvoiceItem & { url?: string }) => {
  if (invoice.url) {
    // For Stripe invoices, open the PDF URL directly
    window.open(invoice.url, '_blank', 'noopener')
  } else {
    // Fallback for non-Stripe invoices
    const blob = new Blob([`Invoice ${invoice.number}\nTotal: ${invoice.total}\nStatus: ${invoice.status}`], {
      type: 'text/plain;charset=utf-8',
    })
    const url = window.URL.createObjectURL(blob)
    window.open(url, '_blank', 'noopener')
    window.URL.revokeObjectURL(url)
  }
}

const scrollToSection = (id: string) => {
  const element = document.getElementById(id)
  if (!element) {
    return
  }

  element.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const navigateHome = () => {
  window.history.pushState({}, '', '/')
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export function AccountDashboard() {
  const [authMode, setAuthMode] = useState<'sign-in' | 'create-account'>('sign-in')
  const [accountEmail, setAccountEmail] = useState('')
  const [accountDisplayName, setAccountDisplayName] = useState('')
  const [accountPassword, setAccountPassword] = useState('')
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('')
  const [sessionToken, setSessionToken] = useState('')
  const [accountName, setAccountName] = useState('Customer')
  const [paypalCheckoutUrl, setPaypalCheckoutUrl] = useState('')
  const [paymentItems, setPaymentItems] = useState(defaultPaymentItems)
  const [paymentRequests, setPaymentRequests] = useState<PaymentRequest[]>([])
  const [invoiceItems, setInvoiceItems] = useState<Array<{ id: string; number: string; total: string; status: 'Open' | 'Paid' | 'Refund requested'; url?: string; createdAt?: string }>>([])
  const [pendingInvoices, setPendingInvoices] = useState<Array<{ id: number; amount_cents: number; currency: string; lineItems: Array<{ description: string; price_cents: number; quantity: number }>; description: string; status: string; created_at: string }>>([])
  const [receiptItems, setReceiptItems] = useState<ReceiptItem[]>([])
  const [supportContacts, setSupportContacts] = useState(defaultSupportContacts)
  const [language, setLanguage] = useState('English')
  const [timeZone, setTimeZone] = useState('Eastern Time')
  const [accessibility, setAccessibility] = useState('Standard')
  const [refundReason, setRefundReason] = useState('')
  const [refundStatuses, setRefundStatuses] = useState<RefundStatus[]>([])
  const [loadingRefunds, setLoadingRefunds] = useState(false)
  const [refundStatus, setRefundStatus] = useState('No refund requested yet.')
  const [accountState, setAccountState] = useState('Active')
  const [shortcutItems, setShortcutItems] = useState(defaultShortcutItems)
  const [loading, setLoading] = useState(true)
  const [signInMessage, setSignInMessage] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentNote, setPaymentNote] = useState('')
  const [paymentMessage, setPaymentMessage] = useState('')
  const [paymentMethodMessage, setPaymentMethodMessage] = useState('')
  const [handledCheckoutSessionId, setHandledCheckoutSessionId] = useState('')
  const [paymentProcessorReady, setPaymentProcessorReady] = useState(false)
  const [billingPortalReady, setBillingPortalReady] = useState(false)

  const accountSummaryCards = useMemo(
    () => [
      {
        label: 'Account status',
        value: accountState,
        description: sessionToken ? 'Your customer record is available.' : 'Sign in to see the full portal.',
      },
      {
        label: 'Primary contact',
        value: supportContacts[0]?.value || 'Admin support',
        description: 'Use this if you need help with billing or requests.',
      },
      {
        label: 'Recent payments',
        value: String(paymentRequests.length),
        description: paymentRequests.length > 0 ? 'Track each charge and confirmation below.' : 'No payments submitted yet.',
      },
    ],
    [accountState, paymentRequests.length, sessionToken, supportContacts],
  )

  useLayoutEffect(() => {
    window.history.scrollRestoration = 'manual'
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
    })
  }, [])

  useEffect(() => {
    const authModeParam = new URLSearchParams(window.location.search).get('mode')

    if (authModeParam === 'create' || authModeParam === 'register') {
      setAuthMode('create-account')
    }

    const loadAccount = async () => {
      try {
        // Only keep sessions in memory - require re-login on page refresh
        const savedEmail = window.localStorage.getItem('accountEmail')

        // Don't auto-restore session - require sign-in every time page loads
        setSignInMessage('')
        setLoading(false)
        return
      } catch {
        // Keep fallback data when the API is unavailable
      } finally {
        setLoading(false)
      }
    }

    loadAccount()
  }, [])

  const applyAccountData = (accountData: AccountApiPayload) => {
    setAccountEmail(accountData.accountEmail)
    setAccountName(accountData.accountName)
    setPaypalCheckoutUrl(accountData.paypalCheckoutUrl || '')
    setPaymentProcessorReady(Boolean(accountData.paymentProcessorReady))
    setBillingPortalReady(Boolean(accountData.billingPortalReady))
    setPaymentItems(accountData.paymentItems)
    setPaymentRequests(accountData.paymentRequests || [])
    setInvoiceItems(accountData.invoiceItems)
    setReceiptItems(accountData.receiptItems)
    setSupportContacts(accountData.supportContacts)
    setLanguage(accountData.preferences.language)
    setTimeZone(accountData.preferences.timeZone)
    setAccessibility(accountData.preferences.accessibility)
    setRefundStatus(accountData.refundStatus)
    setAccountState(accountData.accountState)
    setShortcutItems(accountData.shortcutItems)
  }

  const fetchRefundStatus = async (token: string) => {
    try {
      setLoadingRefunds(true)
      const response = await fetch('/api/account/refund-status', {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        const data = (await response.json()) as { refunds: RefundStatus[] }
        setRefundStatuses(data.refunds || [])
      }
    } catch (error) {
      console.error('Error fetching refund status:', error)
    } finally {
      setLoadingRefunds(false)
    }
  }

  const fetchPendingInvoices = async (token: string) => {
    try {
      const response = await fetch('/api/account/invoices-pending', {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        const data = (await response.json()) as { invoices: typeof pendingInvoices }
        setPendingInvoices(data.invoices || [])
      }
    } catch (error) {
      console.error('Error fetching pending invoices:', error)
    }
  }

  const handleSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSignInMessage('')
    setLoading(true)

    try {
      const response = await fetch('/api/account/sign-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: accountEmail, password: accountPassword }),
      })

      if (!response.ok) {
        setSignInMessage('Invalid email or password.')
        return
      }

      const session = (await response.json()) as AccountSessionResponse
      // Keep token in memory only - don't persist to localStorage
      setSessionToken(session.token)
      window.localStorage.setItem('accountEmail', session.accountEmail)
      setSessionToken(session.token)
      setSignInMessage('Signed in successfully.')

      const accountResponse = await fetch('/api/account/me', {
        headers: { Authorization: `Bearer ${session.token}` },
      })

      if (accountResponse.ok) {
        applyAccountData((await accountResponse.json()) as AccountApiPayload)
        // Also fetch refund status and pending invoices
        await fetchRefundStatus(session.token)
        await fetchPendingInvoices(session.token)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSignUp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSignInMessage('')
    setLoading(true)

    try {
      const response = await fetch('/api/account/sign-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: accountDisplayName,
          email: accountEmail,
          password: accountPassword,
          confirmPassword: signupConfirmPassword,
        }),
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null
        setSignInMessage(payload?.message || 'Unable to create account.')
        return
      }

      const session = (await response.json()) as AccountSignupResponse
      // Keep token in memory only - don't persist to localStorage
      setSessionToken(session.token)
      window.localStorage.setItem('accountEmail', session.accountEmail)
      setSessionToken(session.token)
      setAccountName(session.accountName || accountDisplayName || 'Customer')
      setSignInMessage('Account created successfully.')
      setAuthMode('sign-in')
      setAccountDisplayName('')
      setAccountPassword('')
      setSignupConfirmPassword('')

      const accountResponse = await fetch('/api/account/me', {
        headers: { Authorization: `Bearer ${session.token}` },
      })

      if (accountResponse.ok) {
        applyAccountData((await accountResponse.json()) as AccountApiPayload)
        // Also fetch refund status and pending invoices
        await fetchRefundStatus(session.token)
        await fetchPendingInvoices(session.token)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    const token = sessionToken || ''

    if (token) {
      try {
        await fetch('/api/account/sign-out', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
      } catch {
        // Sign-out should still clear the local session even if the server request fails.
      }
    }

    window.localStorage.removeItem('accountSessionToken')
    window.localStorage.removeItem('accountEmail')
    setSessionToken('')
    setAccountEmail('')
    setAccountPassword('')
    setAccountName('Customer')
    setPaypalCheckoutUrl('')
    setPaymentItems(defaultPaymentItems)
    setPaymentRequests([])
    setInvoiceItems(defaultInvoiceItems)
    setReceiptItems(defaultReceiptItems)
    setSupportContacts(defaultSupportContacts)
    setLanguage('English')
    setTimeZone('Eastern Time')
    setAccessibility('Standard')
    setRefundReason('')
    setRefundStatus('No refund requested yet.')
    setAccountState('Active')
    setShortcutItems(defaultShortcutItems)
    setSignInMessage('Signed out.')
    setPaymentProcessorReady(false)
    setBillingPortalReady(false)
    setPaymentAmount('')
    setPaymentNote('')
    setPaymentMessage('')
    setPaymentMethodMessage('')
    setHandledCheckoutSessionId('')
      setSignupConfirmPassword('')
    navigateHome()
  }

  useEffect(() => {
    const checkoutSessionId = new URLSearchParams(window.location.search).get('checkout_session_id') || ''
    const checkoutResult = new URLSearchParams(window.location.search).get('checkout_result') || ''

    if (!sessionToken || !checkoutSessionId || handledCheckoutSessionId === checkoutSessionId) {
      return
    }

    const refreshCheckoutStatus = async () => {
      try {
        const response = await fetch(`/api/account/payments/session/${checkoutSessionId}`, {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
        })

        if (!response.ok) {
          return
        }

        const payload = (await response.json()) as { payment?: PaymentRequest }

        if (payload.payment) {
          setPaymentRequests((current) => {
            const remaining = current.filter((payment) => payment.checkoutSessionId !== payload.payment?.checkoutSessionId)
            return [payload.payment as PaymentRequest, ...remaining]
          })

          if (payload.payment.status === 'Succeeded' || payload.payment.status === 'Verified') {
            setPaymentMessage(
              payload.payment.confirmationNumber
                ? `✓ Payment successful. Confirmation: ${payload.payment.confirmationNumber}. Your invoice will appear within 1-2 minutes.`
                : '✓ Payment successful. Your invoice will appear within 1-2 minutes.',
            )
          } else if (payload.payment.status === 'Failed') {
            setPaymentMessage(payload.payment.failureReason ? `✗ Payment failed: ${payload.payment.failureReason}` : '✗ Payment failed.')
          } else {
            setPaymentMessage('⏳ Payment is still pending. Checking status...')
          }
        } else if (checkoutResult === 'cancel') {
          setPaymentMessage('Checkout was canceled before payment completed.')
        }
      } catch {
        if (checkoutResult === 'cancel') {
          setPaymentMessage('Checkout was canceled before payment completed.')
        }
      } finally {
        setHandledCheckoutSessionId(checkoutSessionId)
        window.history.replaceState({}, '', '/account')
      }
    }

    refreshCheckoutStatus()
  }, [handledCheckoutSessionId, sessionToken])

  const handleStartCheckout = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPaymentMessage('')

    if (!paymentProcessorReady) {
      setPaymentMessage('Stripe checkout is not configured on this server yet.')
      return
    }

    if (!sessionToken) {
      setPaymentMessage('Sign in before starting checkout.')
      return
    }

    if (!paymentAmount.trim()) {
      setPaymentMessage('Enter a payment amount before starting checkout.')
      return
    }

    try {
      const response = await fetch('/api/account/payments/checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ amount: paymentAmount, note: paymentNote }),
      })

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { message?: string } | null
        setPaymentMessage(data?.message || 'Checkout could not be started.')
        return
      }

      const payload = (await response.json()) as { payment?: { checkoutUrl?: string; checkoutSessionId?: string } }
      if (payload.payment?.checkoutUrl) {
        setPaymentMessage('Redirecting to Stripe Checkout...')
        setHandledCheckoutSessionId(payload.payment.checkoutSessionId || '')
        window.open(payload.payment.checkoutUrl, '_self', 'noopener')
        return
      }

      setPaymentAmount('')
      setPaymentNote('')
      setPaymentMessage('Checkout session created.')
    } catch {
      setPaymentMessage('Checkout could not be started.')
    }
  }

  const handleManagePaymentMethods = async () => {
    setPaymentMethodMessage('')

    if (!sessionToken) {
      setPaymentMethodMessage('Sign in to manage saved payment methods.')
      return
    }

    if (!billingPortalReady) {
      setPaymentMethodMessage('Payment-method management is not configured on this server yet.')
      return
    }

    try {
      const response = await fetch('/api/account/billing-portal/session', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      })

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { message?: string } | null
        setPaymentMethodMessage(data?.message || 'Payment-method management could not be started.')
        return
      }

      const payload = (await response.json()) as BillingPortalSessionResponse

      if (!payload.url) {
        setPaymentMethodMessage('Payment-method management link was unavailable.')
        return
      }

      setPaymentMethodMessage('Redirecting to secure payment-method management...')
      window.open(payload.url, '_self', 'noopener')
    } catch {
      setPaymentMethodMessage('Payment-method management could not be started.')
    }
  }

  const handleRefundRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!refundReason.trim()) {
      setRefundStatus('Add a reason before requesting a refund.')
      return
    }

    try {
      const response = await fetch('/api/account/refunds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: refundReason }),
      })

      if (!response.ok) {
        setRefundStatus('Refund request could not be submitted.')
        return
      }

      const payload = (await response.json()) as { refundStatus?: string }
      setRefundStatus(`Refund request submitted. Current status: ${payload.refundStatus || 'Under review'}.`)
      setRefundReason('')
    } catch {
      setRefundStatus('Refund request could not be submitted.')
    }
  }

  const handleChangePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPasswordMessage('')

    if (!sessionToken) {
      setPasswordMessage('Sign in before changing your password.')
      return
    }

    try {
      const response = await fetch('/api/account/password', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      })

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { message?: string } | null
        setPasswordMessage(data?.message || 'Password update failed.')
        return
      }

      setPasswordMessage('Password updated successfully.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setAccountPassword(newPassword)
      window.localStorage.setItem('accountPasswordHint', 'updated')
    } catch {
      setPasswordMessage('Password update failed.')
    }
  }

  const handleDeactivate = () => {
    setAccountState('Deactivated')
  }

  const handleDelete = () => {
    setAccountState('Deleted request queued')
  }

  const handleShortcutAction = (item: string) => {
    if (item === 'Pay invoice') {
      scrollToSection('secure-checkout')
      const amountInput = document.querySelector<HTMLInputElement>('#secure-checkout input')
      amountInput?.focus()
      return
    }



    if (item === 'Request refund') {
      scrollToSection('support-refunds')
      const refundField = document.querySelector<HTMLTextAreaElement>('#support-refunds textarea')
      refundField?.focus()
      return
    }

    if (item === 'Contact admin') {
      scrollToSection('support-refunds')
      return
    }

    if (item === 'Update payment method') {
      scrollToSection('payment-methods')
      void handleManagePaymentMethods()
    }
  }

  return (
    <div className="page-shell account-page">
      <header className="hero" style={{ background: 'linear-gradient(135deg, #0f172a, #134e4a)' }}>
        <div className="topbar">
          <div>
            <p className="eyebrow">Account</p>
            <h1 style={{ textAlign: 'center' }}>Welcome to your account, {accountName}</h1>
            <p className="hero-subtitle">
              Keep track of what is open, what is paid, and what still needs attention without digging through emails.
            </p>
          </div>
        </div>
        <div className="account-header-actions cta-row">
          {sessionToken ? (
            <button type="button" className="secondary-button" onClick={handleSignOut}>
              Sign out
            </button>
          ) : null}
          <button type="button" className="secondary-button" onClick={navigateHome}>
            Back to home
          </button>
        </div>
        <p className="lead">
          Manage invoices, receipts, payment status, support, and preferences from one place.
        </p>
        <div className="hero-info-grid">
          {sessionToken ? (
            accountSummaryCards.map((card) => (
              <article key={card.label} className="hero-info-card">
                <span className="hero-info-label">{card.label}</span>
                <strong>{card.value}</strong>
                <p>{card.description}</p>
              </article>
            ))
          ) : (
            <article className="hero-info-card hero-info-card-wide">
              <span className="hero-info-label">Get started</span>
              <strong>Sign in to view invoices, receipts, payments, refunds, and preferences.</strong>
              <p>Use the email and password tied to your customer account. If you need help, contact support below.</p>
            </article>
          )}
        </div>
      </header>

      <main className="account-layout">
        <section className="section-block">
          <div className="section-heading">
            <p className="eyebrow">Account access</p>
            <h2>{authMode === 'create-account' ? 'Create your account to save payment details and access the portal.' : 'Create an account or sign in to load your customer record.'}</h2>
          </div>
          <div className="account-auth-actions">
            <button
              type="button"
              className={authMode === 'create-account' ? 'secondary-button' : 'ghost-button'}
              onClick={() => {
                setAuthMode('create-account')
                setSignInMessage('')
              }}
            >
              Switch to create account
            </button>
            <button
              type="button"
              className={authMode === 'sign-in' ? 'secondary-button' : 'ghost-button'}
              onClick={() => {
                setAuthMode('sign-in')
                setSignInMessage('')
              }}
            >
              Switch to sign in
            </button>
          </div>
          <form className="glass account-panel" onSubmit={authMode === 'create-account' ? handleSignUp : handleSignIn}>
            {authMode === 'create-account' ? (
              <label>
                Display name
                <input value={accountDisplayName} onChange={(e) => setAccountDisplayName(e.target.value)} placeholder="Demo Customer" />
              </label>
            ) : null}
            <label>
              Account email
              <input value={accountEmail} onChange={(e) => setAccountEmail(e.target.value)} placeholder="jordan.lee@example.com" />
            </label>
            <label>
              Password
              <input type="password" value={accountPassword} onChange={(e) => setAccountPassword(e.target.value)} placeholder="jordan123" />
            </label>
            {authMode === 'create-account' ? (
              <label>
                Confirm password
                <input type="password" value={signupConfirmPassword} onChange={(e) => setSignupConfirmPassword(e.target.value)} placeholder="jordan123" />
              </label>
            ) : null}
            <button type="submit" className="primary-button">
              {authMode === 'create-account' ? 'Create account' : 'Sign in'}
            </button>
            {authMode === 'create-account' ? (
              <p className="portal-note">Creating an account lets you sign in later to manage invoices, payments, and saved billing tools.</p>
            ) : null}
            {signInMessage && <p className="success-text">{signInMessage}</p>}
          </form>
        </section>

        {sessionToken ? (
          <>
            <section className="section-block">
              <div className="section-heading">
                <p className="eyebrow">Quick actions</p>
                <h2>Shortcuts to the most common account tasks.</h2>
              </div>
              <p className="portal-note">These are the common things most customers need, without making you hunt through every section.</p>
              <div className="shortcut-grid">
                {shortcutItems.map((item) => (
                  <button key={item} type="button" className="glass account-shortcut" onClick={() => handleShortcutAction(item)}>
                    {item}
                  </button>
                ))}
              </div>
            </section>

            {loading && <p>Loading account...</p>}

            <section className="section-block split-layout">
              <div className="glass account-panel" id="payment-status">
                <h3 className="card-label">Payment status</h3>
                <p>Review what has already been handled and what still needs attention.</p>
                <div className="status-stack">
                  {paymentItems.map((payment) => (
                    <article key={payment.id} className={`status-pill status-${payment.status.toLowerCase().replace(/\s+/g, '-')}`}>
                      <strong>{payment.label}</strong>
                      <span>{payment.status}</span>
                      <span>{payment.amount}</span>
                      <span>{payment.method}</span>
                      <span>{payment.date}</span>
                    </article>
                  ))}
                </div>
              </div>

              <div id="secure-checkout" className="glass account-panel">
                <h3 className="card-label">Secure checkout</h3>
                <p>Online payments require a customer account. Sign in first, then enter the amount and note so we can redirect to Stripe Checkout securely.</p>
                {!paymentProcessorReady && <p className="portal-note">Checkout is currently unavailable because Stripe is not configured on the server.</p>}
                <div className="payment-method-chips" aria-label="Supported payment methods">
                  {paymentHighlights.map((method) => (
                    <span key={method} className="badge payment-method-chip">
                      {method}
                    </span>
                  ))}
                </div>
                <form onSubmit={handleStartCheckout} className="refund-form">
                  <label>
                    Amount
                    <input value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="$240.00" />
                  </label>
                  <label>
                    Note
                    <textarea value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} rows={3} placeholder="Add invoice number, timing, or other receipt details." />
                  </label>
                  <button type="submit" className="primary-button" disabled={!paymentProcessorReady}>
                    Start secure checkout
                  </button>
                </form>
                {paypalCheckoutUrl ? (
                  <a className="secondary-button" href={paypalCheckoutUrl} target="_blank" rel="noreferrer">
                    Pay with PayPal
                  </a>
                ) : (
                  <p className="portal-note">PayPal is not configured on the server yet.</p>
                )}
                {paymentMessage && (
                  <div className="success-text" style={{ marginBottom: '16px' }}>
                    <p>{paymentMessage}</p>
                    {paymentMessage.includes('successful') && (
                      <p style={{ fontSize: '0.85em', marginTop: '8px', opacity: '0.8' }}>
                        💡 Tip: Refresh this page in a minute to see your invoice appear automatically.
                      </p>
                    )}
                  </div>
                )}
                <div className="payment-request-list">
                  {paymentRequests.length === 0 ? (
                    <p className="portal-note">No payments submitted yet. After you complete a payment, your confirmation and invoice will appear here.</p>
                  ) : (
                    paymentRequests.map((request) => (
                      <article
                        key={request.checkoutSessionId || request.confirmationNumber}
                        className={`download-row status-${request.status.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        <strong>{request.confirmationNumber || request.checkoutSessionId}</strong>
                        <span>{request.paymentMethod}</span>
                        <span>{request.amount}</span>
                        <span>{request.status}</span>
                        <span>{request.note || 'No note provided'}</span>
                        {request.processorStatus ? <span>Processor: {request.processorStatus}</span> : null}
                        {request.confirmationNumber ? <span>Confirmation: {request.confirmationNumber}</span> : null}
                        {request.failureReason ? <span>Failure: {request.failureReason}</span> : null}
                      </article>
                    ))
                  )}
                </div>
              </div>
            </section>

            <section className="section-block split-layout">
              <div className="glass account-panel">
                <h3 className="card-label">Preferences</h3>
                <p>Choose how you want the portal to feel for you.</p>
                <label>
                  Language
                  <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                    <option>English</option>
                    <option>Spanish</option>
                    <option>French</option>
                  </select>
                </label>
                <label>
                  Time zone
                  <select value={timeZone} onChange={(e) => setTimeZone(e.target.value)}>
                    <option>Eastern Time</option>
                    <option>Central Time</option>
                    <option>Mountain Time</option>
                    <option>Pacific Time</option>
                  </select>
                </label>
                <label>
                  Accessibility
                  <select value={accessibility} onChange={(e) => setAccessibility(e.target.value)}>
                    <option>Standard</option>
                    <option>Large text</option>
                    <option>Reduced motion</option>
                    <option>High contrast</option>
                  </select>
                </label>
              </div>
            </section>

            <section id="invoices-due" className="section-block split-layout">
              <div className="glass account-panel">
                <h3 className="card-label">Invoices due</h3>
                {pendingInvoices.length === 0 ? (
                  <p className="portal-note">No pending invoices. All invoices are paid.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {pendingInvoices.map((invoice) => (
                      <div key={invoice.id} style={{ padding: '12px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <div style={{ marginBottom: '12px' }}>
                          <p style={{ margin: '0 0 4px 0', fontWeight: 'bold' }}>Amount due: ${(invoice.amount_cents / 100).toFixed(2)}</p>
                          {invoice.description && <p style={{ margin: '0', fontSize: '0.9em', opacity: '0.8' }}>{invoice.description}</p>}
                        </div>
                        
                        <div style={{ marginBottom: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                          <p style={{ margin: '0 0 8px 0', fontSize: '0.85em', fontWeight: '500', opacity: '0.7' }}>Services:</p>
                          <div style={{ margin: '0', fontSize: '0.9em' }}>
                            {/* Header row */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '12px', marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.2)', fontSize: '0.85em', fontWeight: '500', opacity: '0.7' }}>
                              <span>Description</span>
                              <span style={{ textAlign: 'right' }}>Price</span>
                              <span style={{ textAlign: 'right' }}>Qty</span>
                              <span style={{ textAlign: 'right' }}>Total</span>
                            </div>
                            {/* Line items */}
                            {invoice.lineItems.map((item, idx) => {
                              const lineTotal = item.price_cents * item.quantity / 100
                              const unitPrice = item.price_cents / 100
                              return (
                                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '12px', marginBottom: '6px', alignItems: 'center' }}>
                                  <span>{item.description}</span>
                                  <span style={{ textAlign: 'right' }}>${unitPrice.toFixed(2)}</span>
                                  <span style={{ textAlign: 'right' }}>{item.quantity}</span>
                                  <span style={{ textAlign: 'right', fontWeight: '500' }}>${lineTotal.toFixed(2)}</span>
                                </div>
                              )
                            })}
                            {/* Total row */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '12px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.2)', fontWeight: '600' }}>
                              <span>Total</span>
                              <span></span>
                              <span></span>
                              <span style={{ textAlign: 'right' }}>${(invoice.amount_cents / 100).toFixed(2)}</span>
                            </div>
                          </div>
                        </div>

                        <button 
                          onClick={() => {
                            const handleInvoiceCheckout = async () => {
                              try {
                                const response = await fetch(`/api/account/invoices/${invoice.id}/checkout`, {
                                  method: 'POST',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    Authorization: `Bearer ${sessionToken}`,
                                  },
                                })

                                if (!response.ok) {
                                  alert('Failed to start checkout')
                                  return
                                }

                                const payload = (await response.json()) as { checkoutUrl?: string }
                                if (payload.checkoutUrl) {
                                  window.open(payload.checkoutUrl, '_self', 'noopener')
                                  return
                                }

                                alert('Checkout could not be started')
                              } catch {
                                alert('Checkout could not be started')
                              }
                            }
                            handleInvoiceCheckout()
                          }}
                          className="primary-button"
                          style={{ width: '100%', padding: '8px' }}
                        >
                          Pay now
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section id="invoice-history" className="section-block split-layout">
              <div className="glass account-panel">
                <h3 className="card-label">Invoice history</h3>
                <p className="portal-note" style={{ marginBottom: '16px' }}>
                  Invoices are automatically created after payments are confirmed. This typically takes 1-2 minutes from payment completion.
                  Check back after your payment to see your invoice and receipt.
                </p>
                <div className="invoice-list">
                  {invoiceItems.length === 0 ? (
                    <p className="portal-note">No invoices yet. Invoices will appear here after your payment is processed.</p>
                  ) : (
                    invoiceItems.map((invoice) => (
                      <article key={invoice.id} className="invoice-row">
                        <strong>{invoice.number}</strong>
                        <span>{invoice.total}</span>
                        <span>{invoice.status}</span>
                        <button type="button" className="secondary-button" onClick={() => viewInvoiceSummary(invoice)}>
                          View
                        </button>
                        <button type="button" className="secondary-button" onClick={() => downloadInvoiceSummary(invoice)}>
                          Download
                        </button>
                      </article>
                    ))
                  )}
                </div>
              </div>
            </section>

            <section className="section-block split-layout">
              <div id="payment-methods" className="glass account-panel">
                <h3 className="card-label">Payment methods</h3>
                <p>Add, update, or remove your saved payment methods after creating and signing in to your customer account.</p>
                <button type="button" className="primary-button" onClick={handleManagePaymentMethods}>
                  Manage payment methods
                </button>
                {paymentMethodMessage && <p className="portal-note">{paymentMethodMessage}</p>}
              </div>

              <div id="support-refunds" className="glass account-panel">
                <h3 className="card-label">Support and refund request</h3>
                <p>Use this area when something needs a quick follow-up or a second look.</p>
                <div className="support-list">
                  {supportContacts.map((contact) => (
                    <p key={contact.label}>
                      <strong>{contact.label}:</strong> {contact.value}
                    </p>
                  ))}
                </div>

                {refundStatuses.length > 0 && (
                  <div style={{ marginBottom: '20px', padding: '12px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                    <h4 style={{ marginTop: 0, marginBottom: '12px' }}>Your Refund Requests</h4>
                    {loadingRefunds ? (
                      <p>Loading refund status...</p>
                    ) : (
                      <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                            <th style={{ textAlign: 'left', padding: '8px' }}>Status</th>
                            <th style={{ textAlign: 'left', padding: '8px' }}>Created</th>
                            <th style={{ textAlign: 'left', padding: '8px' }}>Admin Note</th>
                          </tr>
                        </thead>
                        <tbody>
                          {refundStatuses.map((refund) => (
                            <tr key={refund.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                              <td style={{ padding: '8px' }}>
                                <span style={{
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  backgroundColor: refund.status === 'Approved' ? 'rgba(34,197,94,0.2)' : refund.status === 'Rejected' ? 'rgba(239,68,68,0.2)' : 'rgba(59,130,246,0.2)',
                                  color: refund.status === 'Approved' ? '#22c55e' : refund.status === 'Rejected' ? '#ef4444' : '#3b82f6'
                                }}>
                                  {refund.status}
                                </span>
                              </td>
                              <td style={{ padding: '8px' }}>{new Date(refund.created_at).toLocaleDateString()}</td>
                              <td style={{ padding: '8px', fontSize: '13px', color: '#c9d4e5' }}>{refund.admin_note || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                <form onSubmit={handleRefundRequest} className="refund-form">
                  <label>
                    Refund reason
                    <textarea value={refundReason} onChange={(e) => setRefundReason(e.target.value)} rows={4} />
                  </label>
                  <button type="submit" className="primary-button">
                    Request refund
                  </button>
                </form>
                <p className="success-text">{refundStatus}</p>
              </div>
            </section>

            <section className="section-block split-layout">
              <div className="glass account-panel">
                <h3 className="card-label">Account lifecycle</h3>
                <p>Current account state: {accountState}</p>
                <p className="portal-note">Deactivate or delete the account only if you are done using the portal.</p>
                <div className="cta-row">
                  <button type="button" className="secondary-button" onClick={handleDeactivate}>
                    Deactivate account
                  </button>
                  <button type="button" className="secondary-button" onClick={handleDelete}>
                    Delete account
                  </button>
                </div>
              </div>

              <div className="glass account-panel">
                <h3 className="card-label">Password change</h3>
                <p>Update your password here whenever you want to refresh your login.</p>
                <form onSubmit={handleChangePassword} className="refund-form">
                  <label>
                    Current password
                    <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
                  </label>
                  <label>
                    New password
                    <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                  </label>
                  <label>
                    Confirm new password
                    <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                  </label>
                  <button type="submit" className="primary-button">
                    Update password
                  </button>
                </form>
                {passwordMessage && <p className="success-text">{passwordMessage}</p>}
              </div>
            </section>

          </>
        ) : (
          <section className="section-block">
            <div className="glass account-panel">
              <h3 className="card-label">Account locked</h3>
              <div className="portal-help-grid">
                <div className="portal-help-card">
                  <strong>What you can do</strong>
                  <p>Create an account to check balances, request payments, download receipts, and manage billing tools.</p>
                </div>
                <div className="portal-help-card">
                  <strong>Need help signing in?</strong>
                  <p>Use the email and password tied to your account. If you are stuck, reach out to support by email or phone.</p>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
