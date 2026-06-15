import cors from 'cors'
import express from 'express'
import initSqlJs, { type Database, type QueryResult, type SqlJsStatic } from 'sql.js'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { randomBytes, scryptSync } from 'node:crypto'
import path from 'node:path'

const app = express()
const port = Number(process.env.PORT || 3001)
const dbDir = path.join(process.cwd(), 'data')
const dbPath = path.join(dbDir, 'notconcrete.sqlite')
const require = createRequire(import.meta.url)

let SQL: SqlJsStatic | null = null
let db: Database | null = null

mkdirSync(dbDir, { recursive: true })

const schema = `
  CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    featured INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS testimonials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    quote TEXT NOT NULL,
    rating INTEGER NOT NULL DEFAULT 5,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS gallery_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    before_label TEXT NOT NULL,
    after_label TEXT NOT NULL,
    description TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS service_areas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS quote_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    service_type TEXT NOT NULL,
    property_type TEXT NOT NULL,
    address TEXT NOT NULL,
    preferred_date TEXT,
    details TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS admin_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`

const seedStatements = [
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

const saveDb = () => {
  if (!db) {
    return
  }

  const data = db.export()
  writeFileSync(dbPath, Buffer.from(data))
}

const connect = async () => {
  if (!SQL) {
    const wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm')
    SQL = await initSqlJs({ locateFile: () => wasmPath })
  }

  if (!db) {
    db = existsSync(dbPath) ? new SQL.Database(readFileSync(dbPath)) : new SQL.Database()
    db.exec(schema)

    for (const statement of seedStatements) {
      db.exec(statement)
    }
  }

  // Migration: Always check and add status column if it doesn't exist
  try {
    db.run('SELECT status FROM quote_requests LIMIT 1')
  } catch {
    console.log('Adding status column to quote_requests table...')
    try {
      db.run('ALTER TABLE quote_requests ADD COLUMN status TEXT NOT NULL DEFAULT \'new\'')
    } catch (alterError) {
      console.error('ALTER TABLE failed:', alterError)
    }
  }

  saveDb()
  return db
}

const run = async <T>(callback: (database: Database) => T | Promise<T>) => {
  const database = await connect()
  const result = await callback(database)
  saveDb()
  return result
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

app.use(cors())
app.use(express.json())
app.use('/data', express.static(dbDir))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/site', async (_req, res) => {
  await run((database) => {
    const services = database.exec('SELECT * FROM services ORDER BY featured DESC, sort_order ASC')[0]
    const testimonials = database.exec('SELECT * FROM testimonials ORDER BY sort_order ASC')[0]
    const gallery = database.exec('SELECT * FROM gallery_items ORDER BY sort_order ASC')[0]
    const serviceAreas = database.exec('SELECT * FROM service_areas ORDER BY sort_order ASC')[0]

    const rowsToObjects = (result?: QueryResult) => {
      if (!result) {
        return []
      }

      return result.values.map((row: unknown[]) =>
        Object.fromEntries(result.columns.map((column, index) => [column, row[index]])),
      )
    }

    res.json({
      services: rowsToObjects(services),
      testimonials: rowsToObjects(testimonials),
      gallery: rowsToObjects(gallery),
      serviceAreas: rowsToObjects(serviceAreas),
    })
  })
})

app.get('/api/quotes', async (_req, res) => {
  await run((database) => {
    const result = database.exec('SELECT * FROM quote_requests ORDER BY datetime(created_at) DESC')[0]
    const quotes = result
      ? result.values.map((row: unknown[]) =>
          Object.fromEntries(result.columns.map((column, index) => [column, row[index]])),
        )
      : []
    res.json({ quotes })
  })
})

app.post('/api/quotes', async (req, res) => {
  const body = req.body as Record<string, string | undefined>
  const requiredFields = ['fullName', 'phone', 'email', 'serviceType', 'propertyType', 'address', 'details']
  const missing = requiredFields.filter((field) => !body[field] || String(body[field]).trim().length === 0)

  if (missing.length > 0) {
    res.status(400).json({ message: `Missing required fields: ${missing.join(', ')}` })
    return
  }

  await run((database) => {
    const statement = database.prepare(`
      INSERT INTO quote_requests (full_name, phone, email, service_type, property_type, address, preferred_date, details)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)

    statement.run([
      body.fullName?.trim(),
      body.phone?.trim(),
      body.email?.trim(),
      body.serviceType?.trim(),
      body.propertyType?.trim(),
      body.address?.trim(),
      body.preferredDate?.trim() || null,
      body.details?.trim(),
    ])
    statement.free()
    res.status(201).json({ ok: true })
  })
})

// Admin authentication middleware
const checkAdminAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization
  const password = authHeader?.replace('Bearer ', '')
  
  if (!password) {
    res.status(401).json({ message: 'Unauthorized' })
    return
  }
  
  // Verify password against database (will be verified in route handler)
  res.locals.adminPassword = password
  next()
}

const verifyAdminPassword = async (password: string): Promise<boolean> => {
  return new Promise((resolve) => {
    run((database) => {
      const result = database.exec('SELECT password_hash, password_salt FROM admin_settings WHERE id = 1')
      if (!result || result.length === 0 || result[0].values.length === 0) {
        resolve(false)
        return
      }
      
      const [hash, salt] = result[0].values[0] as [string, string]
      const isValid = verifyPassword(password, hash, salt)
      resolve(isValid)
    }).catch(() => resolve(false))
  })
}

// Admin: Check setup status
app.get('/api/admin/setup-status', async (_req, res) => {
  await run((database) => {
    const result = database.exec('SELECT COUNT(*) as count FROM admin_settings')
    const isSetup = result && result[0] && result[0].values[0][0] > 0
    res.json({ isSetup })
  })
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
    await run((database) => {
      // Check if already setup
      const existing = database.exec('SELECT COUNT(*) as count FROM admin_settings')
      if (existing && existing[0] && existing[0].values[0][0] > 0) {
        throw new Error('Admin password already set')
      }
      
      const { hash, salt } = hashPassword(password)
      const statement = database.prepare('INSERT INTO admin_settings (id, password_hash, password_salt) VALUES (1, ?, ?)')
      statement.run([hash, salt])
      statement.free()
    })
    
    res.json({ ok: true })
  } catch (error) {
    res.status(400).json({ message: 'Setup failed' })
  }
})

// Admin: Get all quotes
app.get('/api/admin/quotes', checkAdminAuth, async (req, res) => {
  const password = res.locals.adminPassword as string
  const isValid = await verifyAdminPassword(password)
  if (!isValid) {
    return res.status(401).json({ message: 'Unauthorized' })
  }
  await run((database) => {
    const result = database.exec('SELECT * FROM quote_requests ORDER BY datetime(created_at) DESC')[0]
    const quotes = result
      ? result.values.map((row: unknown[]) =>
          Object.fromEntries(result.columns.map((column, index) => [column, row[index]])),
        )
      : []
    res.json({ quotes })
  })
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
    
    await run((database) => {
      const { hash, salt } = hashPassword(newPassword)
      const statement = database.prepare('UPDATE admin_settings SET password_hash = ?, password_salt = ? WHERE id = 1')
      statement.run([hash, salt])
      statement.free()
    })
    
    res.json({ ok: true })
  } catch (error) {
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
  const id = req.params.id
  const body = req.body as Record<string, unknown>
  const status = String(body.status || '').toLowerCase().trim()

  if (!status || !['new', 'contacted', 'completed', 'archived'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status' })
  }

  const quoteId = parseInt(id, 10)
  if (isNaN(quoteId)) {
    return res.status(400).json({ message: 'Invalid id' })
  }

  await run((database) => {
    const statement = database.prepare('UPDATE quote_requests SET status = ? WHERE id = ?')
    statement.run([status, quoteId])
    statement.free()
    res.json({ ok: true })
  })
})

// Admin: Delete quote
app.delete('/api/admin/quotes/:id', checkAdminAuth, async (req, res) => {
  const password = res.locals.adminPassword as string
  const isValid = await verifyAdminPassword(password)
  if (!isValid) {
    return res.status(401).json({ message: 'Unauthorized' })
  }
  const id = req.params.id

  await run((database) => {
    const statement = database.prepare('DELETE FROM quote_requests WHERE id = ?')
    statement.run([parseInt(id)])
    statement.free()
    res.json({ ok: true })
  })
})

// Admin: Export quotes as CSV
app.get('/api/admin/quotes/export/csv', checkAdminAuth, async (req, res) => {
  const password = res.locals.adminPassword as string
  const isValid = await verifyAdminPassword(password)
  if (!isValid) {
    return res.status(401).json({ message: 'Unauthorized' })
  }
  await run((database) => {
    const result = database.exec('SELECT * FROM quote_requests ORDER BY datetime(created_at) DESC')[0]
    
    if (!result || result.values.length === 0) {
      res.json({ message: 'No quotes to export' })
      return
    }

    const csvHeader = result.columns.join(',')
    const csvRows = result.values.map((row: unknown[]) =>
      row.map((val) => {
        const str = String(val ?? '')
        return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str
      }).join(',')
    )
    
    const csv = [csvHeader, ...csvRows].join('\n')
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename="quotes.csv"')
    res.send(csv)
  })
})

if (existsSync(path.join(process.cwd(), 'dist', 'client'))) {
  app.use(express.static(path.join(process.cwd(), 'dist', 'client')))
  app.use((_req, res) => {
    res.sendFile(path.join(process.cwd(), 'dist', 'client', 'index.html'))
  })
}

app.listen(port, () => {
  console.log(`Not Concrete Cleaning Co. API running on http://localhost:${port}`)
})