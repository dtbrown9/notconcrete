import cors from 'cors'
import express from 'express'
import { Pool } from 'pg'
import { randomBytes, scryptSync } from 'node:crypto'
import path from 'node:path'
import dotenv from 'dotenv'
import dns from 'node:dns'

// Force IPv4 DNS resolution (fixes Render/Supabase connection issues)
dns.setDefaultResultOrder('ipv4first')

// Load environment variables from .env.local (development only)
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: '.env.local' })
}

const app = express()
const port = Number(process.env.PORT || 3001)

// Log database connection status
console.log(`NODE_ENV: ${process.env.NODE_ENV || 'development'}`)
console.log(`DATABASE_URL is ${process.env.DATABASE_URL ? 'SET' : 'NOT SET'}`)
console.log(`DNS resolution set to IPv4 first`)

// PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

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

// Initialize database schema
const initializeDatabase = async () => {
  const client = await pool.connect()
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS services (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL,
        featured INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS testimonials (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        quote TEXT NOT NULL,
        rating INTEGER NOT NULL DEFAULT 5,
        sort_order INTEGER NOT NULL DEFAULT 0
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS gallery_items (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        before_label TEXT NOT NULL,
        after_label TEXT NOT NULL,
        description TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS service_areas (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS quote_requests (
        id SERIAL PRIMARY KEY,
        full_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT NOT NULL,
        service_type TEXT NOT NULL,
        property_type TEXT NOT NULL,
        address TEXT NOT NULL,
        preferred_date TEXT,
        details TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'new',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_settings (
        id INTEGER PRIMARY KEY DEFAULT 1,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Seed data
    const seedQueries = [
      `INSERT INTO services (title, description, category, featured, sort_order) 
       SELECT 'Final Cleaning', 'Post-construction final cleaning that removes dust, debris, smudges, and leftover material before turnover.', 'Construction Cleaning', 1, 1
       WHERE NOT EXISTS (SELECT 1 FROM services WHERE title = 'Final Cleaning')`,
      `INSERT INTO services (title, description, category, featured, sort_order) 
       SELECT 'Mid-Project Cleaning', 'Routine cleanup during active builds to keep the site safer, more organized, and easier to inspect.', 'Construction Cleaning', 1, 2
       WHERE NOT EXISTS (SELECT 1 FROM services WHERE title = 'Mid-Project Cleaning')`,
      `INSERT INTO services (title, description, category, featured, sort_order) 
       SELECT 'Pre-Construction Prep', 'Prepping the site before work begins, including clearing surfaces, removing debris, and making space ready.', 'Construction Cleaning', 1, 3
       WHERE NOT EXISTS (SELECT 1 FROM services WHERE title = 'Pre-Construction Prep')`,
      `INSERT INTO services (title, description, category, featured, sort_order) 
       SELECT 'Move-Out / Before Move-In Cleaning', 'Deep cleaning for homes, apartments, and offices before moving out or before new occupants arrive.', 'Residential & Commercial', 1, 4
       WHERE NOT EXISTS (SELECT 1 FROM services WHERE title = 'Move-Out / Before Move-In Cleaning')`,
      `INSERT INTO services (title, description, category, featured, sort_order) 
       SELECT 'Demo Cleanup', 'Cleanup after demolition to remove debris, dust, and leftover materials from the job site.', 'Cleanup Services', 0, 5
       WHERE NOT EXISTS (SELECT 1 FROM services WHERE title = 'Demo Cleanup')`,
      `INSERT INTO services (title, description, category, featured, sort_order) 
       SELECT 'Bulk Trash Removal', 'Removal of unwanted bulk items, construction waste, and site trash so the property stays clear.', 'Cleanup Services', 0, 6
       WHERE NOT EXISTS (SELECT 1 FROM services WHERE title = 'Bulk Trash Removal')`,
      `INSERT INTO services (title, description, category, featured, sort_order) 
       SELECT 'Commercial & Residential Power Washing', 'Power washing for sidewalks, driveways, exterior walls, patios, storefronts, and other exterior surfaces.', 'Exterior Care', 1, 7
       WHERE NOT EXISTS (SELECT 1 FROM services WHERE title = 'Commercial & Residential Power Washing')`,
      `INSERT INTO services (title, description, category, featured, sort_order) 
       SELECT 'Eviction Cleanups', 'Fast, respectful cleanup for rental turnovers, evictions, and abandoned spaces needing a fresh restart.', 'Specialty Services', 1, 8
       WHERE NOT EXISTS (SELECT 1 FROM services WHERE title = 'Eviction Cleanups')`,
      `INSERT INTO testimonials (name, role, quote, rating, sort_order) 
       SELECT 'Marcus T.', 'Property Manager', 'They handled a full turnover, demo cleanup, and final wash with zero headaches. Professional from start to finish.', 5, 1
       WHERE NOT EXISTS (SELECT 1 FROM testimonials WHERE name = 'Marcus T.')`,
      `INSERT INTO testimonials (name, role, quote, rating, sort_order) 
       SELECT 'Angela R.', 'Homeowner', 'The move-out cleaning was thorough and the crew was on time, respectful, and easy to work with.', 5, 2
       WHERE NOT EXISTS (SELECT 1 FROM testimonials WHERE name = 'Angela R.')`,
      `INSERT INTO testimonials (name, role, quote, rating, sort_order) 
       SELECT 'Javier S.', 'Contractor', 'Their mid-project cleaning kept our site ready for inspection. We now use them on every build.', 5, 3
       WHERE NOT EXISTS (SELECT 1 FROM testimonials WHERE name = 'Javier S.')`,
      `INSERT INTO gallery_items (title, before_label, after_label, description, sort_order) 
       SELECT 'Construction Final Clean', 'Dusty shell', 'Move-in ready finish', 'A full post-build cleanup that turns a worksite into a polished final product.', 1
       WHERE NOT EXISTS (SELECT 1 FROM gallery_items WHERE title = 'Construction Final Clean')`,
      `INSERT INTO gallery_items (title, before_label, after_label, description, sort_order) 
       SELECT 'Driveway Power Wash', 'Stained concrete', 'Bright restored surface', 'Professional exterior washing for concrete, sidewalks, patios, and entryways.', 2
       WHERE NOT EXISTS (SELECT 1 FROM gallery_items WHERE title = 'Driveway Power Wash')`,
      `INSERT INTO gallery_items (title, before_label, after_label, description, sort_order) 
       SELECT 'Vacant Property Cleanup', 'Leftover debris', 'Clear and ready', 'Eviction and turnover cleanup that prepares a property for the next tenant or owner.', 3
       WHERE NOT EXISTS (SELECT 1 FROM gallery_items WHERE title = 'Vacant Property Cleanup')`,
      `INSERT INTO service_areas (name, sort_order) 
       SELECT 'Local metro area', 1 WHERE NOT EXISTS (SELECT 1 FROM service_areas WHERE name = 'Local metro area')`,
      `INSERT INTO service_areas (name, sort_order) 
       SELECT 'Nearby suburbs', 2 WHERE NOT EXISTS (SELECT 1 FROM service_areas WHERE name = 'Nearby suburbs')`,
      `INSERT INTO service_areas (name, sort_order) 
       SELECT 'Commercial districts', 3 WHERE NOT EXISTS (SELECT 1 FROM service_areas WHERE name = 'Commercial districts')`,
      `INSERT INTO service_areas (name, sort_order) 
       SELECT 'Industrial and construction sites', 4 WHERE NOT EXISTS (SELECT 1 FROM service_areas WHERE name = 'Industrial and construction sites')`,
    ]

    for (const query of seedQueries) {
      await client.query(query)
    }

    console.log('Database initialized successfully')
  } catch (error) {
    console.error('Error initializing database:', error)
  } finally {
    client.release()
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
    const services = await pool.query('SELECT * FROM services ORDER BY featured DESC, sort_order ASC')
    const testimonials = await pool.query('SELECT * FROM testimonials ORDER BY sort_order ASC')
    const gallery = await pool.query('SELECT * FROM gallery_items ORDER BY sort_order ASC')
    const serviceAreas = await pool.query('SELECT * FROM service_areas ORDER BY sort_order ASC')

    res.json({
      services: services.rows,
      testimonials: testimonials.rows,
      gallery: gallery.rows,
      serviceAreas: serviceAreas.rows,
    })
  } catch (error) {
    console.error('Error fetching site data from database, using fallback data:', error)
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
    await pool.query(
      `INSERT INTO quote_requests (full_name, phone, email, service_type, property_type, address, preferred_date, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        body.fullName?.trim(),
        body.phone?.trim(),
        body.email?.trim(),
        body.serviceType?.trim(),
        body.propertyType?.trim(),
        body.address?.trim(),
        body.preferredDate?.trim() || null,
        body.details?.trim(),
      ],
    )
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
    const result = await pool.query('SELECT password_hash, password_salt FROM admin_settings WHERE id = 1')
    if (result.rows.length === 0) {
      return false
    }

    const { password_hash, password_salt } = result.rows[0]
    return verifyPassword(password, password_hash, password_salt)
  } catch {
    return false
  }
}

// Admin: Check setup status
app.get('/api/admin/setup-status', async (_req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(*) as count FROM admin_settings')
    const isSetup = parseInt(result.rows[0].count, 10) > 0
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
    const existing = await pool.query('SELECT COUNT(*) as count FROM admin_settings')
    if (parseInt(existing.rows[0].count, 10) > 0) {
      return res.status(400).json({ message: 'Admin password already set' })
    }

    const { hash, salt } = hashPassword(password)
    await pool.query('INSERT INTO admin_settings (id, password_hash, password_salt) VALUES ($1, $2, $3)', [
      1,
      hash,
      salt,
    ])

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
    const result = await pool.query('SELECT * FROM quote_requests ORDER BY created_at DESC')
    res.json({ quotes: result.rows })
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
    await pool.query('UPDATE admin_settings SET password_hash = $1, password_salt = $2 WHERE id = 1', [hash, salt])

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
    await pool.query('UPDATE quote_requests SET status = $1 WHERE id = $2', [status, quoteId] as any)
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
    await pool.query('DELETE FROM quote_requests WHERE id = $1', [parseInt(id, 10)] as any[])
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
    const result = await pool.query('SELECT * FROM quote_requests ORDER BY created_at DESC')

    if (result.rows.length === 0) {
      res.json({ message: 'No quotes to export' })
      return
    }

    const columns = Object.keys(result.rows[0])
    const csvHeader = columns.join(',')
    const csvRows = result.rows.map((row: Record<string, unknown>) =>
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
