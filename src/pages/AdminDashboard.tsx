import { useEffect, useState } from 'react'
import { generateSubtleGradient } from '../utils/gradientGenerator'

type Quote = {
  id: number
  full_name: string
  phone: string
  email: string
  service_type: string
  property_type: string
  address: string
  preferred_date: string
  details: string
  status: string
  created_at: string
}

type Feedback = {
  id: number
  name: string
  email: string
  rating: string
  message: string
  reviewed: boolean
  created_at: string
}

type PaymentRequest = {
  confirmationNumber: string
  paymentMethod: string
  amount: string
  note: string
  status: string
  adminNote: string
  createdAt: string
  verifiedAt: string
}

type RefundRequest = {
  id: number
  user_email: string
  confirmation_number: string
  amount_cents: number
  reason: string
  status: string
  admin_note: string
  stripe_refund_id: string
  created_at: string
  updated_at: string
  resolved_at: string
}

type PageView = 'login' | 'setup' | 'dashboard' | 'settings'

export function AdminDashboard() {
  const [currentPage, setCurrentPage] = useState<PageView>('login')
  const [password, setPassword] = useState('')
  const [setupPassword, setSetupPassword] = useState('')
  const [setupConfirm, setSetupConfirm] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [feedback, setFeedback] = useState<Feedback[]>([])
  const [paymentRequests, setPaymentRequests] = useState<PaymentRequest[]>([])
  const [refundRequests, setRefundRequests] = useState<RefundRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [error, setError] = useState('')
  const [heroGradient, setHeroGradient] = useState('')
  const [confirmationNumber, setConfirmationNumber] = useState('')
  const [paymentAdminNote, setPaymentAdminNote] = useState('')
  const [paymentMessage, setPaymentMessage] = useState('')
  const [paymentError, setPaymentError] = useState('')
  const [refundMessage, setRefundMessage] = useState('')
  const [refundError, setRefundError] = useState('')
  const [invoices, setInvoices] = useState<any[]>([])
  const [invoiceCustomerEmail, setInvoiceCustomerEmail] = useState('')
  const [invoiceDescription, setInvoiceDescription] = useState('')
  const [invoiceLineItems, setInvoiceLineItems] = useState<Array<{ description: string; price_cents: number; quantity: number }>>([
    { description: '', price_cents: 0, quantity: 1 },
  ])
  const [invoiceMessage, setInvoiceMessage] = useState('')
  const [invoiceError, setInvoiceError] = useState('')

  // Settings state
  const [currentPasswordInput, setCurrentPasswordInput] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('')
  const [passwordChangeMessage, setPasswordChangeMessage] = useState('')
  const [passwordChangeError, setPasswordChangeError] = useState('')

  // Check setup status on mount
  useEffect(() => {
    checkSetupStatus()
    setHeroGradient(generateSubtleGradient())
  }, [])

  const checkSetupStatus = async () => {
    try {
      const response = await fetch('/api/admin/setup-status')
      if (response.ok) {
        const data = await response.json()
        setCurrentPage(data.isSetup ? 'login' : 'setup')
      }
    } catch (err) {
      console.error('Error checking setup status:', err)
      setCurrentPage('login')
    } finally {
      setLoading(false)
    }
  }

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!setupPassword || setupPassword.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    if (setupPassword !== setupConfirm) {
      setError('Passwords do not match')
      return
    }

    try {
      const response = await fetch('/api/admin/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: setupPassword, confirmPassword: setupConfirm }),
      })

      if (response.ok) {
        setSetupPassword('')
        setSetupConfirm('')
        setCurrentPage('login')
        setError('Password set successfully! Please log in.')
        setTimeout(() => setError(''), 3000)
      } else {
        const data = await response.json()
        setError(data.message || 'Setup failed')
      }
    } catch (err) {
      setError('Setup failed')
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    try {
      // Verify password by trying to fetch quotes
      const response = await fetch('/api/admin/quotes', {
        headers: { Authorization: `Bearer ${password}` },
      })

      if (response.ok) {
        setIsAuthenticated(true)
        setCurrentPage('dashboard')
        fetchQuotes(password)
      } else {
        setError('Invalid password')
      }
    } catch (err) {
      setError('Login failed')
    }
  }

  const fetchQuotes = async (authPassword: string) => {
    setLoading(true)
    try {
      const [quotesResponse, feedbackResponse, paymentRequestsResponse, refundRequestsResponse, invoicesResponse] = await Promise.all([
        fetch('/api/admin/quotes', {
          headers: { Authorization: `Bearer ${authPassword}` },
        }),
        fetch('/api/admin/feedback', {
          headers: { Authorization: `Bearer ${authPassword}` },
        }),
        fetch('/api/admin/payment-requests', {
          headers: { Authorization: `Bearer ${authPassword}` },
        }),
        fetch('/api/admin/refund-requests', {
          headers: { Authorization: `Bearer ${authPassword}` },
        }),
        fetch('/api/admin/invoices', {
          headers: { Authorization: `Bearer ${authPassword}` },
        }),
      ])

      if (quotesResponse.ok) {
        const data = await quotesResponse.json()
        setQuotes(data.quotes)
      } else {
        setError('Failed to fetch quotes')
      }

      if (feedbackResponse.ok) {
        const data = await feedbackResponse.json()
        setFeedback(data.feedback)
      } else {
        setError('Failed to fetch feedback')
      }

      if (paymentRequestsResponse.ok) {
        const data = await paymentRequestsResponse.json()
        setPaymentRequests(data.paymentRequests)
      } else {
        setError('Failed to fetch payment requests')
      }

      if (refundRequestsResponse.ok) {
        const data = await refundRequestsResponse.json()
        setRefundRequests(data.refunds || [])
      } else {
        setError('Failed to fetch refund requests')
      }

      if (invoicesResponse.ok) {
        const data = await invoicesResponse.json()
        setInvoices(data.invoices || [])
      } else {
        setError('Failed to fetch invoices')
      }

      if (quotesResponse.ok && feedbackResponse.ok && paymentRequestsResponse.ok && refundRequestsResponse.ok && invoicesResponse.ok) {
        setError('')
      }
    } catch (err) {
      setError('Error fetching dashboard data')
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (id: number, newStatus: string) => {
    try {
      const response = await fetch(`/api/admin/quotes/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${password}`,
        },
        body: JSON.stringify({ status: newStatus }),
      })

      if (response.ok) {
        setQuotes(quotes.map((q) => (q.id === id ? { ...q, status: newStatus } : q)))
      }
    } catch (err) {
      setError('Failed to update status')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this quote?')) return

    try {
      const response = await fetch(`/api/admin/quotes/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${password}` },
      })

      if (response.ok) {
        setQuotes(quotes.filter((q) => q.id !== id))
      }
    } catch (err) {
      setError('Failed to delete quote')
    }
  }

  const handleExport = async () => {
    try {
      const response = await fetch('/api/admin/quotes/export/csv', {
        headers: { Authorization: `Bearer ${password}` },
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `quotes-${new Date().toISOString().split('T')[0]}.csv`
        a.click()
        window.URL.revokeObjectURL(url)
      }
    } catch (err) {
      setError('Failed to export quotes')
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordChangeError('')
    setPasswordChangeMessage('')

    if (!newPassword || newPassword.length < 6) {
      setPasswordChangeError('New password must be at least 6 characters')
      return
    }

    if (newPassword !== newPasswordConfirm) {
      setPasswordChangeError('Passwords do not match')
      return
    }

    try {
      const response = await fetch('/api/admin/password', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentPasswordInput}`,
        },
        body: JSON.stringify({ newPassword, confirmPassword: newPasswordConfirm }),
      })

      if (response.ok) {
        setPasswordChangeMessage('Password changed successfully!')
        setCurrentPasswordInput('')
        setNewPassword('')
        setNewPasswordConfirm('')
        // Update the auth password for future requests
        setPassword(newPassword)
        setTimeout(() => setPasswordChangeMessage(''), 3000)
      } else {
        const data = await response.json()
        setPasswordChangeError(data.message || 'Failed to change password')
      }
    } catch (err) {
      setPasswordChangeError('Failed to change password')
    }
  }

  const handleApproveRefund = async (refundId: number, confirmationNumber: string) => {
    setRefundError('')
    setRefundMessage('')

    if (!confirmationNumber) {
      setRefundError('Cannot approve: no payment associated with this refund')
      return
    }

    try {
      const response = await fetch(`/api/admin/refund-requests/${refundId}/update-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${password}`,
        },
        body: JSON.stringify({
          status: 'Approved',
          adminNote: 'Refund approved and issued',
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        setRefundError(data?.message || 'Failed to approve refund')
        return
      }

      const result = await response.json()
      if (result.error) {
        setRefundError(`Refund approved but warning: ${result.error}`)
      } else {
        setRefundMessage(`✓ Refund issued successfully${result.stripeRefundId ? ` (ID: ${result.stripeRefundId})` : ''}`)
      }
      await fetchQuotes(password)
      setTimeout(() => setRefundMessage(''), 5000)
    } catch (err) {
      setRefundError('Failed to approve refund')
    }
  }

  const handleRejectRefund = async (refundId: number) => {
    setRefundError('')
    setRefundMessage('')

    try {
      const response = await fetch(`/api/admin/refund-requests/${refundId}/update-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${password}`,
        },
        body: JSON.stringify({
          status: 'Rejected',
          adminNote: 'Refund rejected',
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        setRefundError(data?.message || 'Failed to reject refund')
        return
      }

      setRefundMessage('Refund rejected')
      await fetchQuotes(password)
      setTimeout(() => setRefundMessage(''), 3000)
    } catch (err) {
      setRefundError('Failed to reject refund')
    }
  }

  const handleCreateInvoice = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setInvoiceError('')
    setInvoiceMessage('')

    if (!invoiceCustomerEmail.trim()) {
      setInvoiceError('Customer email is required')
      return
    }

    const validLineItems = invoiceLineItems.filter((item) => item.description.trim() && item.price_cents > 0)
    if (validLineItems.length === 0) {
      setInvoiceError('At least one line item with description and price is required')
      return
    }

    try {
      const response = await fetch('/api/admin/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${password}`,
        },
        body: JSON.stringify({
          customerEmail: invoiceCustomerEmail,
          description: invoiceDescription,
          lineItems: validLineItems,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        setInvoiceError(data?.message || 'Failed to create invoice')
        return
      }

      setInvoiceMessage('Invoice created and sent to customer')
      setInvoiceCustomerEmail('')
      setInvoiceDescription('')
      setInvoiceLineItems([{ description: '', price_cents: 0, quantity: 1 }])
      await fetchQuotes(password)
      setTimeout(() => setInvoiceMessage(''), 3000)
    } catch (err) {
      setInvoiceError('Failed to create invoice')
    }
  }

  const handleVerifyPaymentRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPaymentError('')
    setPaymentMessage('')

    if (!confirmationNumber.trim()) {
      setPaymentError('Enter a confirmation number.')
      return
    }

    try {
      const response = await fetch('/api/admin/payment-requests/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${password}`,
        },
        body: JSON.stringify({ confirmationNumber, adminNote: paymentAdminNote }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        setPaymentError(data?.message || 'Failed to verify payment request')
        return
      }

      const payload = (await response.json()) as { paymentRequest?: PaymentRequest }
      if (payload.paymentRequest) {
        setPaymentRequests((current) =>
          current.map((request) =>
            request.confirmationNumber === payload.paymentRequest?.confirmationNumber ? payload.paymentRequest! : request,
          ),
        )
        setPaymentMessage(`Verified ${payload.paymentRequest.confirmationNumber}.`)
      } else {
        setPaymentMessage('Payment request verified.')
      }

      setConfirmationNumber('')
      setPaymentAdminNote('')
      await fetchQuotes(password)
    } catch {
      setPaymentError('Failed to verify payment request')
    }
  }

  const filteredQuotes = quotes.filter((quote) => {
    const matchesSearch =
      quote.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quote.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quote.phone.includes(searchTerm) ||
      quote.address.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === 'all' || quote.status === statusFilter

    return matchesSearch && matchesStatus
  })

  if (loading) {
    return <div className="admin-loading">Loading...</div>
  }

  const HeroSection = () => (
    <div className="admin-hero" style={{ background: heroGradient }}>
      <div className="admin-hero-overlay">
        <h1>Admin Dashboard</h1>
        <p>Manage customer quotes and account settings</p>
      </div>
    </div>
  )

  if (currentPage === 'setup') {
    return (
      <>
        <HeroSection />
        <div className="admin-login-container">
          <div className="admin-login-card glass">
          <h2>Set Admin Password</h2>
          <p style={{ color: '#c9d4e5', marginBottom: '20px', fontSize: '14px' }}>
            This is your first time setting up the admin dashboard. Please create a secure password.
          </p>
          <form onSubmit={handleSetup}>
            <div className="form-group">
              <label htmlFor="setup-password">Admin Password</label>
              <input
                id="setup-password"
                type="password"
                value={setupPassword}
                onChange={(e) => setSetupPassword(e.target.value)}
                placeholder="At least 6 characters"
              />
            </div>
            <div className="form-group">
              <label htmlFor="setup-confirm">Confirm Password</label>
              <input
                id="setup-confirm"
                type="password"
                value={setupConfirm}
                onChange={(e) => setSetupConfirm(e.target.value)}
                placeholder="Confirm your password"
              />
            </div>
            {error && <div className="error-text">{error}</div>}
            <button type="submit" className="primary-button">
              Set Password
            </button>
          </form>
          </div>
        </div>
      </>
    )
  }

  if (currentPage === 'login' || !isAuthenticated) {
    return (
      <>
        <HeroSection />
        <div className="admin-login-container">
          <div className="admin-login-card glass">
          <h2>Admin Dashboard</h2>
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label htmlFor="password">Admin Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
              />
            </div>
            {error && <div className="error-text">{error}</div>}
            <button type="submit" className="primary-button">
              Login
            </button>
          </form>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <HeroSection />
      <div className="admin-header">
        <h2>Quote Management Dashboard</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => {
              setCurrentPage('settings')
              setPasswordChangeError('')
              setPasswordChangeMessage('')
            }}
            className="secondary-button"
          >
            Settings
          </button>
          <button
            onClick={() => {
              setIsAuthenticated(false)
              setCurrentPage('login')
              setPassword('')
            }}
            className="secondary-button"
          >
            Logout
          </button>
        </div>
      </div>

      {currentPage === 'settings' ? (
        <div className="admin-settings">
          <h3>Change Password</h3>
          <form onSubmit={handleChangePassword} style={{ maxWidth: '400px' }}>
            <div className="form-group">
              <label htmlFor="current-password">Current Password</label>
              <input
                id="current-password"
                type="password"
                value={currentPasswordInput}
                onChange={(e) => setCurrentPasswordInput(e.target.value)}
                placeholder="Enter your current password"
              />
            </div>
            <div className="form-group">
              <label htmlFor="new-password">New Password</label>
              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
              />
            </div>
            <div className="form-group">
              <label htmlFor="new-password-confirm">Confirm New Password</label>
              <input
                id="new-password-confirm"
                type="password"
                value={newPasswordConfirm}
                onChange={(e) => setNewPasswordConfirm(e.target.value)}
                placeholder="Confirm your new password"
              />
            </div>
            {passwordChangeError && <div className="error-text">{passwordChangeError}</div>}
            {passwordChangeMessage && <div className="success-text">{passwordChangeMessage}</div>}
            <button type="submit" className="primary-button">
              Change Password
            </button>
          </form>
          <button
            onClick={() => setCurrentPage('dashboard')}
            className="secondary-button"
            style={{ marginTop: '20px' }}
          >
            Back to Dashboard
          </button>
        </div>
      ) : (
        <>
          <div className="admin-controls">
            <div className="admin-search">
              <input
                type="text"
                placeholder="Search by name, email, phone, or address..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="admin-filters">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All Status</option>
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>

              <button onClick={handleExport} className="secondary-button" disabled={quotes.length === 0}>
                Export as CSV
              </button>
            </div>
          </div>

          <div className="admin-feedback-section" style={{ marginTop: '24px' }}>
            <h3>Payment Records</h3>
            <p style={{ marginTop: 0, color: '#c9d4e5' }}>
              Stripe charges should resolve automatically. Keep the confirmation-number form below only for manual or offline payments.
            </p>
            <form onSubmit={handleVerifyPaymentRequest} style={{ display: 'grid', gap: '12px', maxWidth: '520px' }}>
              <div className="form-group">
                <label htmlFor="confirmation-number">Confirmation Number (manual/offline only)</label>
                <input
                  id="confirmation-number"
                  type="text"
                  value={confirmationNumber}
                  onChange={(e) => setConfirmationNumber(e.target.value)}
                  placeholder="KC-1A2B3C4D"
                />
              </div>
              <div className="form-group">
                <label htmlFor="payment-admin-note">Admin Note</label>
                <textarea
                  id="payment-admin-note"
                  value={paymentAdminNote}
                  onChange={(e) => setPaymentAdminNote(e.target.value)}
                  rows={3}
                  placeholder="Optional verification note"
                />
              </div>
              {paymentError && <div className="error-text">{paymentError}</div>}
              {paymentMessage && <div className="success-text">{paymentMessage}</div>}
              <button type="submit" className="primary-button">
                Verify Manual Payment
              </button>
            </form>

            <div className="admin-table-container" style={{ marginTop: '20px' }}>
              {paymentRequests.length === 0 ? (
                <div className="admin-empty">No payment requests found</div>
              ) : (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Confirmation</th>
                      <th>Session</th>
                      <th>Method</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Processor</th>
                      <th>Note</th>
                      <th>Admin Note</th>
                      <th>Created</th>
                      <th>Verified</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentRequests.map((request) => (
                      <tr key={request.checkoutSessionId || request.confirmationNumber}>
                        <td className="cell-name">{request.confirmationNumber}</td>
                        <td className="cell-details">
                          <span title={request.checkoutSessionId}>{request.checkoutSessionId || '—'}</span>
                        </td>
                        <td>{request.paymentMethod}</td>
                        <td>{request.amount}</td>
                        <td>{request.status}</td>
                        <td>{request.processorStatus || '—'}</td>
                        <td className="cell-details">
                          <span title={request.note}>{request.note || '—'}</span>
                        </td>
                        <td className="cell-details">
                          <span title={request.adminNote}>{request.adminNote || '—'}</span>
                        </td>
                        <td className="cell-date">{request.createdAt ? new Date(request.createdAt).toLocaleDateString() : '—'}</td>
                        <td className="cell-date">{request.verifiedAt ? new Date(request.verifiedAt).toLocaleDateString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {error && <div className="admin-error">{error}</div>}

          {loading && <div className="admin-loading">Loading quotes...</div>}

          {!loading && filteredQuotes.length === 0 ? (
            <div className="admin-empty">No quotes found</div>
          ) : (
            <div className="admin-table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Service</th>
                    <th>Property Type</th>
                    <th>Address</th>
                    <th>Preferred Date</th>
                    <th>Details</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredQuotes.map((quote) => (
                    <tr key={quote.id} className={`status-${quote.status}`}>
                      <td className="cell-name">{quote.full_name}</td>
                      <td className="cell-email">
                        <a href={`mailto:${quote.email}`}>{quote.email}</a>
                      </td>
                      <td className="cell-phone">
                        <a href={`tel:${quote.phone}`}>{quote.phone}</a>
                      </td>
                      <td>{quote.service_type}</td>
                      <td>{quote.property_type}</td>
                      <td className="cell-address">{quote.address}</td>
                      <td>{quote.preferred_date || '—'}</td>
                      <td className="cell-details">
                        <span title={quote.details}>{quote.details.substring(0, 50)}...</span>
                      </td>
                      <td>
                        <select
                          value={quote.status}
                          onChange={(e) => handleStatusChange(quote.id, e.target.value)}
                          className={`status-select status-${quote.status}`}
                        >
                          <option value="new">New</option>
                          <option value="contacted">Contacted</option>
                          <option value="completed">Completed</option>
                          <option value="archived">Archived</option>
                        </select>
                      </td>
                      <td className="cell-date">{new Date(quote.created_at).toLocaleDateString()}</td>
                      <td className="cell-actions">
                        <button
                          onClick={() => handleDelete(quote.id)}
                          className="btn-delete"
                          title="Delete quote"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="admin-footer">
            <p>Total quotes: {quotes.length} | Filtered: {filteredQuotes.length}</p>
          </div>

          <div className="admin-feedback-section" style={{ marginTop: '32px' }}>
            <h3>Customer Feedback for Review</h3>
            {feedback.length === 0 ? (
              <div className="admin-empty">No feedback received yet</div>
            ) : (
              <div className="admin-table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Rating</th>
                      <th>Message</th>
                      <th>Reviewed</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {feedback.map((item) => (
                      <tr key={item.id}>
                        <td className="cell-name">{item.name}</td>
                        <td className="cell-email">
                          <a href={`mailto:${item.email}`}>{item.email}</a>
                        </td>
                        <td>{item.rating}</td>
                        <td className="cell-details">
                          <span title={item.message}>{item.message.substring(0, 70)}...</span>
                        </td>
                        <td>{item.reviewed ? 'Yes' : 'No'}</td>
                        <td className="cell-date">{new Date(item.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="admin-feedback-section" style={{ marginTop: '32px' }}>
            <h3>Refund Requests</h3>
            {refundRequests.length === 0 ? (
              <div className="admin-empty">No refund requests</div>
            ) : (
              <div className="admin-table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Amount</th>
                      <th>Reason</th>
                      <th>Status</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {refundRequests.map((refund) => (
                      <tr key={refund.id}>
                        <td className="cell-email">
                          <div>
                            <a href={`mailto:${refund.user_email}`}>{refund.user_email}</a>
                            {refund.confirmation_number && (
                              <p style={{ fontSize: '0.85em', margin: '4px 0 0 0', opacity: '0.7' }}>
                                Order: {refund.confirmation_number}
                              </p>
                            )}
                          </div>
                        </td>
                        <td>
                          {refund.amount_cents > 0 ? `$${(refund.amount_cents / 100).toFixed(2)}` : '—'}
                        </td>
                        <td className="cell-details">
                          <span title={refund.reason}>{refund.reason.substring(0, 60)}...</span>
                        </td>
                        <td>
                          {refund.status === 'Refunded' ? (
                            <span style={{ color: '#4ade80', fontWeight: 'bold' }}>✓ Refunded</span>
                          ) : refund.status === 'Rejected' ? (
                            <span style={{ color: '#ef4444' }}>✗ Rejected</span>
                          ) : (
                            <span>{refund.status}</span>
                          )}
                        </td>
                        <td className="cell-date">{new Date(refund.created_at).toLocaleDateString()}</td>
                        <td className="cell-actions">
                          {refund.status === 'Pending' ? (
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button
                                onClick={() => handleApproveRefund(refund.id, refund.confirmation_number)}
                                className="primary-button"
                                style={{ padding: '4px 8px', fontSize: '12px' }}
                                title="Approve refund and issue to customer"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleRejectRefund(refund.id)}
                                className="secondary-button"
                                style={{ padding: '4px 8px', fontSize: '12px' }}
                              >
                                Reject
                              </button>
                            </div>
                          ) : refund.status === 'Refunded' ? (
                            <span style={{ fontSize: '12px', opacity: '0.7' }}>Done</span>
                          ) : (
                            <span style={{ fontSize: '12px', opacity: '0.7' }}>{refund.status}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {refundError && <div className="error-text" style={{ marginTop: '12px' }}>{refundError}</div>}
            {refundMessage && <div className="success-text" style={{ marginTop: '12px' }}>{refundMessage}</div>}
          </div>

          <div style={{ marginBottom: '40px' }}>
            <h3>Create Invoice</h3>
            <form onSubmit={handleCreateInvoice} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <div>
                <label>
                  Customer Email:
                  <input
                    type="email"
                    value={invoiceCustomerEmail}
                    onChange={(e) => setInvoiceCustomerEmail(e.target.value)}
                    placeholder="customer@example.com"
                    style={{ marginTop: '4px', width: '100%', padding: '8px', borderRadius: '4px' }}
                  />
                </label>
              </div>

              <div>
                <label>
                  Invoice Description (optional):
                  <input
                    type="text"
                    value={invoiceDescription}
                    onChange={(e) => setInvoiceDescription(e.target.value)}
                    placeholder="e.g., Cleaning Services - July"
                    style={{ marginTop: '4px', width: '100%', padding: '8px', borderRadius: '4px' }}
                  />
                </label>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px' }}>Services/Items:</label>
                <div style={{ marginBottom: '8px', display: 'grid', gridTemplateColumns: '1fr 120px 80px auto', gap: '8px', fontSize: '0.85em', opacity: '0.7', fontWeight: '500', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <span>Description</span>
                  <span style={{ textAlign: 'center' }}>Price ($)</span>
                  <span style={{ textAlign: 'center' }}>Qty</span>
                  <span></span>
                </div>
                {invoiceLineItems.map((item, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 80px auto', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="Service description"
                      value={item.description}
                      onChange={(e) => {
                        const updated = [...invoiceLineItems]
                        updated[idx].description = e.target.value
                        setInvoiceLineItems(updated)
                      }}
                      style={{ padding: '6px', borderRadius: '4px' }}
                    />
                    <input
                      type="number"
                      placeholder="0.00"
                      value={item.price_cents / 100}
                      onChange={(e) => {
                        const updated = [...invoiceLineItems]
                        updated[idx].price_cents = Math.round(parseFloat(e.target.value || '0') * 100)
                        setInvoiceLineItems(updated)
                      }}
                      min="0"
                      step="0.01"
                      style={{ padding: '6px', borderRadius: '4px', textAlign: 'center' }}
                    />
                    <input
                      type="number"
                      placeholder="1"
                      value={item.quantity}
                      onChange={(e) => {
                        const updated = [...invoiceLineItems]
                        updated[idx].quantity = Math.max(1, parseInt(e.target.value || '1'))
                        setInvoiceLineItems(updated)
                      }}
                      min="1"
                      style={{ padding: '6px', borderRadius: '4px', textAlign: 'center' }}
                    />
                    {invoiceLineItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setInvoiceLineItems(invoiceLineItems.filter((_, i) => i !== idx))}
                        className="secondary-button"
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
                
                {/* Invoice Total */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 80px auto', gap: '8px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.2)', fontWeight: '600', fontSize: '1.1em' }}>
                  <span style={{ textAlign: 'right', gridColumn: '1 / 2' }}>Invoice Total:</span>
                  <span style={{ textAlign: 'center', gridColumn: '2 / 3' }}>${(invoiceLineItems.reduce((sum, item) => sum + item.price_cents * item.quantity, 0) / 100).toFixed(2)}</span>
                </div>

                <button
                  type="button"
                  onClick={() => setInvoiceLineItems([...invoiceLineItems, { description: '', price_cents: 0, quantity: 1 }])}
                  className="secondary-button"
                  style={{ padding: '6px 12px', fontSize: '12px', marginTop: '12px' }}
                >
                  + Add line item
                </button>
              </div>

              <button type="submit" className="primary-button" style={{ padding: '10px' }}>
                Create & Send Invoice
              </button>
            </form>

            {invoiceError && <div className="error-text">{invoiceError}</div>}
            {invoiceMessage && <div className="success-text">{invoiceMessage}</div>}

            <h3 style={{ marginTop: '30px' }}>Invoices</h3>
            {invoices.length === 0 ? (
              <div className="admin-empty">No invoices created</div>
            ) : (
              <div className="admin-table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Created</th>
                      <th>Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((invoice) => (
                      <tr key={invoice.id}>
                        <td className="cell-email">{invoice.user_email}</td>
                        <td>${(invoice.amount_cents / 100).toFixed(2)}</td>
                        <td>
                          {invoice.status === 'Paid' ? (
                            <span style={{ color: '#4ade80', fontWeight: 'bold' }}>✓ Paid</span>
                          ) : (
                            <span>{invoice.status}</span>
                          )}
                        </td>
                        <td className="cell-date">{new Date(invoice.created_at).toLocaleDateString()}</td>
                        <td className="cell-date">{invoice.paid_at ? new Date(invoice.paid_at).toLocaleDateString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </>
  )
}
