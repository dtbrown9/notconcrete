import { useEffect, useState } from 'react'

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

type PageView = 'login' | 'setup' | 'dashboard' | 'settings'

export function AdminDashboard() {
  const [currentPage, setCurrentPage] = useState<PageView>('login')
  const [password, setPassword] = useState('')
  const [setupPassword, setSetupPassword] = useState('')
  const [setupConfirm, setSetupConfirm] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [error, setError] = useState('')

  // Settings state
  const [currentPasswordInput, setCurrentPasswordInput] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('')
  const [passwordChangeMessage, setPasswordChangeMessage] = useState('')
  const [passwordChangeError, setPasswordChangeError] = useState('')

  // Check setup status on mount
  useEffect(() => {
    checkSetupStatus()
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
      const response = await fetch('/api/admin/quotes', {
        headers: { Authorization: `Bearer ${authPassword}` },
      })
      if (response.ok) {
        const data = await response.json()
        setQuotes(data.quotes)
        setError('')
      } else {
        setError('Failed to fetch quotes')
      }
    } catch (err) {
      setError('Error fetching quotes')
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

  if (currentPage === 'setup') {
    return (
      <div className="admin-login">
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
    )
  }

  if (currentPage === 'login' || !isAuthenticated) {
    return (
      <div className="admin-login">
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
    )
  }

  return (
    <div className="admin-dashboard">
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
        </>
      )}
    </div>
  )
}
