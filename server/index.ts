import cors from 'cors'
import express from 'express'
import { randomBytes, scryptSync } from 'node:crypto'
import path from 'node:path'
import dotenv from 'dotenv'

// Load environment variables from .env.local (development only)
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: '.env.local' })
}

const app = express()
const port = Number(process.env.PORT || 3001)

// Supabase configuration
const supabaseUrl = 'https://nbkahtpyukqojfbumcwz.supabase.co'
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ia2FodHB5dWtxb2pmYnVtY3d6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1ODEzNjgsImV4cCI6MjA5NzE1NzM2OH0.yQSkC8RzWPZWHzPzxzDc-i64_wARg_qPMpv50btDoDo'

// Log configuration
console.log(`NODE_ENV: ${process.env.NODE_ENV || 'development'}`)
console.log(`Supabase URL: ${supabaseUrl}`)
console.log(`Using Supabase REST API (HTTPS, works on Render)`)

// Helper to make Supabase REST API requests
async function supabaseQuery(sql: string, params: unknown[] = []): Promise<unknown> {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/execute_query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseAnonKey}`,
      'Content-Type': 'application/json',
      'apikey': supabaseAnonKey,
    },
    body: JSON.stringify({ sql, params }),
  })

  if (!response.ok) {
    throw new Error(`Supabase API error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

// Simpler fetch-based approach for REST API
async function supabaseSelect(table: string, options?: { order?: string; limit?: number }) {
  const url = new URL(`${supabaseUrl}/rest/v1/${table}`)
  if (options?.order) {
    url.searchParams.set('order', options.order)
  }
  if (options?.limit) {
    url.searchParams.set('limit', String(options.limit))
  }

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${supabaseAnonKey}`,
      'apikey': supabaseAnonKey,
    },
  })

  if (!response.ok) {
    throw new Error(`Supabase API error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

async function supabaseInsert(table: string, data: Record<string, unknown>) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseAnonKey}`,
      'apikey': supabaseAnonKey,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Supabase API error: ${response.status} ${error}`)
  }

  return response.json()
}

// Password hashing utilities
const hashPassword = (password: string): { hash: string; salt: string } => {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return { hash, salt }
}

const verifyPassword = (password: string, hash: string, salt: string): boolean => {
  try {
    const computed = scryptSync(password, salt, 64).toString('hex')
    return computed === hash
  } catch {
    return false
  }
}

// Fallback mock data for when database is unavailable
const fallbackData = {
  services: [
    {
      id: 1,
      title: 'Construction Cleanup',
      description: 'Post-construction cleanup and debris removal',
      category: 'Construction',
      featured: 1,
      sort_order: 1,
    },
    {
      id: 2,
      title: 'Move-Out Cleaning',
      description: 'Thorough cleaning for move-outs and turnovers',
      category: 'Residential',
      featured: 1,
      sort_order: 2,
    },
    {
      id: 3,
      title: 'Eviction Cleanups',
      description: 'Professional eviction cleanup services',
      category: 'Residential',
      featured: 1,
      sort_order: 3,
    },
    {
      id: 4,
      title: 'Bulk Trash Removal',
      description: 'Large-scale debris and trash hauling',
      category: 'General',
      featured: 0,
      sort_order: 4,
    },
    {
      id: 5,
      title: 'Power Washing',
      description: 'Commercial and residential power washing',
      category: 'General',
      featured: 0,
      sort_order: 5,
    },
    {
      id: 6,
      title: 'Commercial Cleaning',
      description: 'Office and commercial space cleaning',
      category: 'Commercial',
      featured: 0,
      sort_order: 6,
    },
    {
      id: 7,
      title: 'Pressure Washing',
      description: 'Driveways, decks, and exterior pressure washing',
      category: 'General',
      featured: 0,
      sort_order: 7,
    },
    {
      id: 8,
      title: 'Specialized Cleanup',
      description: 'Custom cleanup solutions for unique projects',
      category: 'General',
      featured: 0,
      sort_order: 8,
    },
  ],
  testimonials: [
    {
      id: 1,
      name: 'Sarah Martinez',
      role: 'Property Manager',
      quote: 'Professional crew, thorough work, and they actually cared about getting it right.',
      rating: 5,
      sort_order: 1,
    },
    {
      id: 2,
      name: 'John Chen',
      role: 'Contractor',
      quote: 'Fast turnaround on post-construction cleanup. Highly recommend for any contractor.',
      rating: 5,
      sort_order: 2,
    },
    {
      id: 3,
      name: 'Lisa Thompson',
      role: 'Landlord',
      quote: 'Reliable, punctual, and they handle the whole process from quote to completion.',
      rating: 5,
      sort_order: 3,
    },
  ],
  gallery: [
    {
      id: 1,
      title: 'Construction Site Cleanup',
      before_label: 'Before',
      after_label: 'After',
      description: 'Complete debris removal and site preparation',
      sort_order: 1,
    },
    {
      id: 2,
      title: 'Power Washing Transformation',
      before_label: 'Before',
      after_label: 'After',
      description: 'Professional exterior power washing results',
      sort_order: 2,
    },
  ],
  serviceAreas: [
    { id: 1, name: 'Local metro area', sort_order: 1 },
    { id: 2, name: 'Nearby suburbs', sort_order: 2 },
    { id: 3, name: 'Commercial districts', sort_order: 3 },
    { id: 4, name: 'Industrial and construction sites', sort_order: 4 },
  ],
}

// Initialize database on startup (just log status with REST API)
const initializeDatabase = async () => {
  try {
    // Test connection by fetching services
    await supabaseSelect('services', { limit: 1 })
    console.log('✅ Supabase REST API connection successful')
  } catch (error) {
    console.error('⚠️ Supabase connection failed, using fallback data:', error)
  }
}

// Initialize on startup
initializeDatabase().catch(console.error)

app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/site', async (_req, res) => {
  try {
    const services = await supabaseSelect('services', { order: 'featured.desc,sort_order.asc' })
    const testimonials = await supabaseSelect('testimonials', { order: 'sort_order.asc' })
    const gallery = await supabaseSelect('gallery_items', { order: 'sort_order.asc' })
    const serviceAreas = await supabaseSelect('service_areas', { order: 'sort_order.asc' })

    res.json({
      services: services || [],
      testimonials: testimonials || [],
      gallery: gallery || [],
      serviceAreas: serviceAreas || [],
    })
  } catch (error) {
    console.error('Error fetching site data from REST API, using fallback data:', error)
    // Use fallback data when database is unavailable
    res.json(fallbackData)
  }
})

app.get('/api/quotes', async (_req, res) => {
  try {
    const result = await pool.query('SELECT * FROM quote_requests ORDER BY created_at DESC')
    res.json({ quotes: result.rows })
  } catch (error) {
    console.error('Error fetching quotes:', error)
    res.status(500).json({ message: 'Failed to fetch quotes' })
  }
})

app.post('/api/quotes', async (req, res) => {
  const body = req.body as Record<string, string | undefined>
  const requiredFields = ['fullName', 'phone', 'email', 'serviceType', 'propertyType', 'address', 'details']
  const missing = requiredFields.filter((field) => !body[field] || String(body[field]).trim().length === 0)

  if (missing.length > 0) {
    res.status(400).json({ message: `Missing required fields: ${missing.join(', ')}` })
    return
  }

  try {
    await supabaseInsert('quote_requests', {
      full_name: body.fullName?.trim(),
      phone: body.phone?.trim(),
      email: body.email?.trim(),
      service_type: body.serviceType?.trim(),
      property_type: body.propertyType?.trim(),
      address: body.address?.trim(),
      preferred_date: body.preferredDate?.trim() || null,
      details: body.details?.trim(),
    })
    res.status(201).json({ ok: true })
  } catch (error) {
    console.error('Error creating quote:', error)
    res.status(500).json({ message: 'Failed to create quote' })
  }
})

// Admin authentication middleware
const checkAdminAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization
  const password = authHeader?.replace('Bearer ', '')

  if (!password) {
    res.status(401).json({ message: 'Unauthorized' })
    return
  }

  res.locals.adminPassword = password
  next()
}

const verifyAdminPassword = async (password: string): Promise<boolean> => {
  try {
    const result = await supabaseSelect('admin_settings', { limit: 1 })
    if (!result || result.length === 0) {
      return false
    }

    const { password_hash, password_salt } = result[0] as { password_hash: string; password_salt: string }
    return verifyPassword(password, password_hash, password_salt)
  } catch {
    return false
  }
}

// Admin: Check setup status
app.get('/api/admin/setup-status', async (_req, res) => {
  try {
    const result = await supabaseSelect('admin_settings', { limit: 1 })
    const isSetup = result && result.length > 0
    res.json({ isSetup })
  } catch (error) {
    console.error('Error checking setup status:', error)
    res.status(500).json({ message: 'Failed to check setup status' })
  }
})

// Admin: Initial password setup
app.post('/api/admin/setup', async (req, res) => {
  const body = req.body as Record<string, unknown>
  const password = String(body.password || '').trim()
  const confirmPassword = String(body.confirmPassword || '').trim()

  if (!password || password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' })
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ message: 'Passwords do not match' })
  }

  try {
    // Check if already setup
    const existing = await supabaseSelect('admin_settings', { limit: 1 })
    if (existing && existing.length > 0) {
      return res.status(400).json({ message: 'Admin password already set' })
    }

    const { hash, salt } = hashPassword(password)
    await supabaseInsert('admin_settings', {
      id: 1,
      password_hash: hash,
      password_salt: salt,
    })

    res.json({ ok: true })
  } catch (error) {
    console.error('Error setting up admin:', error)
    res.status(500).json({ message: 'Setup failed' })
  }
})

// Admin: Get all quotes
app.get('/api/admin/quotes', checkAdminAuth, async (req, res) => {
  const password = res.locals.adminPassword as string
  const isValid = await verifyAdminPassword(password)
  if (!isValid) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  try {
    const quotes = await supabaseSelect('quote_requests', { order: 'created_at.desc' })
    res.json({ quotes: quotes || [] })
  } catch (error) {
    console.error('Error fetching admin quotes:', error)
    res.status(500).json({ message: 'Failed to fetch quotes' })
  }
})

// Admin: Change password
app.patch('/api/admin/password', checkAdminAuth, async (req, res) => {
  const currentPassword = res.locals.adminPassword as string
  const body = req.body as Record<string, unknown>
  const newPassword = String(body.newPassword || '').trim()
  const confirmPassword = String(body.confirmPassword || '').trim()

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' })
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ message: 'Passwords do not match' })
  }

  try {
    const isValid = await verifyAdminPassword(currentPassword)
    if (!isValid) {
      return res.status(401).json({ message: 'Current password is incorrect' })
    }

    const { hash, salt } = hashPassword(newPassword)
    
    // Update admin password via REST API
    const response = await fetch(`${supabaseUrl}/rest/v1/admin_settings?id=eq.1`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'apikey': supabaseAnonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password_hash: hash, password_salt: salt }),
    })

    if (!response.ok) {
      throw new Error(`Update failed: ${response.status}`)
    }

    res.json({ ok: true })
  } catch (error) {
    console.error('Error changing password:', error)
    res.status(500).json({ message: 'Failed to change password' })
  }
})

// Admin: Update quote status
app.patch('/api/admin/quotes/:id', checkAdminAuth, async (req, res) => {
  const password = res.locals.adminPassword as string
  const isValid = await verifyAdminPassword(password)
  if (!isValid) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  const id = req.params.id as string
  const body = req.body as Record<string, unknown>
  const statusVal = body.status
  const status = String(statusVal || '').toLowerCase().trim() as string

  if (!status || !['new', 'contacted', 'completed', 'archived'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status' })
  }

  const quoteId = parseInt(id, 10)
  if (isNaN(quoteId)) {
    return res.status(400).json({ message: 'Invalid id' })
  }

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/quote_requests?id=eq.${quoteId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'apikey': supabaseAnonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status }),
    })

    if (!response.ok) {
      throw new Error(`Update failed: ${response.status}`)
    }

    res.json({ ok: true })
  } catch (error) {
    console.error('Error updating quote:', error)
    res.status(500).json({ message: 'Failed to update quote' })
  }
})

// Admin: Delete quote
app.delete('/api/admin/quotes/:id', checkAdminAuth, async (req, res) => {
  const password = res.locals.adminPassword as string
  const isValid = await verifyAdminPassword(password)
  if (!isValid) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  const id = req.params.id as string

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/quote_requests?id=eq.${parseInt(id, 10)}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'apikey': supabaseAnonKey,
      },
    })

    if (!response.ok) {
      throw new Error(`Delete failed: ${response.status}`)
    }

    res.json({ ok: true })
  } catch (error) {
    console.error('Error deleting quote:', error)
    res.status(500).json({ message: 'Failed to delete quote' })
  }
})

// Admin: Export quotes as CSV
app.get('/api/admin/quotes/export/csv', checkAdminAuth, async (req, res) => {
  const password = res.locals.adminPassword as string
  const isValid = await verifyAdminPassword(password)
  if (!isValid) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  try {
    const quotes = await supabaseSelect('quote_requests', { order: 'created_at.desc' })

    if (!quotes || quotes.length === 0) {
      res.json({ message: 'No quotes to export' })
      return
    }

    const columns = Object.keys(quotes[0])
    const csvHeader = columns.join(',')
    const csvRows = quotes.map((row: Record<string, unknown>) =>
      columns
        .map((col) => {
          const cellVal = row[col]
          const val = String(Array.isArray(cellVal) ? cellVal.join(',') : cellVal ?? '')
          return val.includes(',') || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val
        })
        .join(','),
    )

    const csv = [csvHeader, ...csvRows].join('\n')
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename="quotes.csv"')
    res.send(csv)
  } catch (error) {
    console.error('Error exporting quotes:', error)
    res.status(500).json({ message: 'Failed to export quotes' })
  }
})

// Serve static files
if (path.join(process.cwd(), 'dist', 'client')) {
  app.use(express.static(path.join(process.cwd(), 'dist', 'client')))
  app.use((_req, res) => {
    res.sendFile(path.join(process.cwd(), 'dist', 'client', 'index.html'))
  })
}

app.listen(port, () => {
  console.log(`Not Concrete Cleaning Co. API running on http://localhost:${port}`)
})
