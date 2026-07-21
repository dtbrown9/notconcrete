import cors from 'cors'
import express from 'express'
import { randomBytes, scryptSync } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import dotenv from 'dotenv'
import initSqlJs, { type Database } from 'sql.js'

// Load environment variables from .env.local (development only)
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: '.env.local' })
}

const app = express()
const port = Number(process.env.PORT || 3001)
const isTestEnvironment = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true' || Boolean(process.env.VITEST_WORKER_ID)
const shouldRedirectHttp = process.env.ENABLE_HTTPS_REDIRECT !== 'false' && process.env.NODE_ENV !== 'development'
const shouldEnableHsts = process.env.ENABLE_HSTS === 'true' || process.env.NODE_ENV === 'production'
const secureConnectSrc = ["'self'", 'https://nbkahtpyukqojfbumcwz.supabase.co', 'http://localhost:3001'].join(' ')
const appPublicUrl = process.env.APP_PUBLIC_URL || 'http://localhost:5173'

app.use(
  express.json({
    limit: '1mb',
    verify: (req, _res, buffer) => {
      ;(req as express.Request & { rawBody?: Buffer }).rawBody = Buffer.from(buffer)
    },
  }),
)
app.use(express.urlencoded({ extended: false, limit: '1mb' }))

// Supabase configuration
const supabaseUrl = 'https://nbkahtpyukqojfbumcwz.supabase.co'
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ia2FodHB5dWtxb2pmYnVtY3d6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1ODEzNjgsImV4cCI6MjA5NzE1NzM2OH0.yQSkC8RzWPZWHzPzxzDc-i64_wARg_qPMpv50btDoDo'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey
const supabaseApiKey = supabaseServiceKey

type StripeCheckoutSession = {
  id: string
  url?: string
  status?: string
  payment_status?: string
  payment_intent?: string | { id?: string }
  client_reference_id?: string
  customer_details?: { email?: string }
  amount_total?: number
  currency?: string
  metadata?: Record<string, unknown>
  description?: string
}

type StripeWebhookEvent = {
  type: string
  data: {
    object: StripeCheckoutSession
  }
}

type StripeClient = {
  customers: {
    create(params: Record<string, unknown>): Promise<{ id: string }>
  }
  billingPortal: {
    sessions: {
      create(params: Record<string, unknown>): Promise<{ id: string; url: string }>
    }
  }
  checkout: {
    sessions: {
      create(params: Record<string, unknown>): Promise<StripeCheckoutSession>
      retrieve(sessionId: string): Promise<StripeCheckoutSession>
    }
  }
  webhooks: {
    constructEvent(rawBody: Buffer | string, signature: string, secret: string): StripeWebhookEvent
  }
}

type StripeConstructor = new (secretKey: string, options?: { apiVersion?: string }) => StripeClient

// Log configuration
console.log(`NODE_ENV: ${process.env.NODE_ENV || 'development'}`)
console.log(`Supabase URL: ${supabaseUrl}`)
console.log(`Using Supabase REST API (HTTPS, works on Render)`)

// Helper to make Supabase REST API requests
async function supabaseQuery(sql: string, params: unknown[] = []): Promise<unknown> {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/execute_query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseApiKey}`,
      'Content-Type': 'application/json',
      'apikey': supabaseApiKey,
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
      'Authorization': `Bearer ${supabaseApiKey}`,
      'apikey': supabaseApiKey,
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
      'Authorization': `Bearer ${supabaseApiKey}`,
      'apikey': supabaseApiKey,
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

function normalizeGalleryItem(item: Record<string, unknown>) {
  const imageUrl =
    item.image_url ??
    item.image ??
    item.before_image_url ??
    item.after_image_url ??
    item.photo_url ??
    item.before_image ??
    item.after_image ??
    item.photo ??
    item.url ??
    item.public_url

  return {
    ...item,
    image_url: typeof imageUrl === 'string' ? imageUrl : undefined,
  }
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
  feedback: [],
  serviceAreas: [
    { id: 1, name: 'Local metro area', sort_order: 1 },
    { id: 2, name: 'Nearby suburbs', sort_order: 2 },
    { id: 3, name: 'Commercial districts', sort_order: 3 },
    { id: 4, name: 'Industrial and construction sites', sort_order: 4 },
  ],
}

type FeedbackRecord = {
  id: number
  name: string
  email: string
  rating: string
  message: string
  reviewed: boolean
  created_at: string
}

type AccountPaymentItem = {
  id: string
  label: string
  status: 'Paid' | 'Pending' | 'Overdue'
  amount: string
  method: string
  date: string
}

type AccountInvoiceItem = {
  id: string
  number: string
  total: string
  status: 'Open' | 'Paid' | 'Refund requested'
}

type AccountReceiptItem = {
  id: string
  label: string
  createdAt: string
}

type AccountSupportContact = {
  label: string
  value: string
}

type PaymentMethod =
  | 'Apple Pay'
  | 'Debit card'
  | 'Credit card'
  | 'Direct deposit'
  | 'Zelle'
  | 'Cash App'
  | 'Venmo'
  | 'PayPal'
  | 'Cash'
  | 'Stripe Checkout'

type AccountPaymentRequest = {
  accountEmail: string
  confirmationNumber: string
  paymentMethod: PaymentMethod
  amount: string
  note: string
  status: string
  adminNote: string
  createdAt: string
  verifiedAt: string
  checkoutSessionId?: string
  paymentIntentId?: string
  processorStatus?: string
  failureReason?: string
  receiptUrl?: string
  amountCents?: number
  currency?: string
}

type AccountPayload = {
  accountEmail: string
  accountName: string
  billingPortalUrl: string
  paypalCheckoutUrl: string
  paymentProcessorReady: boolean
  paymentItems: AccountPaymentItem[]
  paymentRequests: AccountPaymentRequest[]
  invoiceItems: AccountInvoiceItem[]
  receiptItems: AccountReceiptItem[]
  supportContacts: AccountSupportContact[]
  preferences: {
    language: string
    timeZone: string
    accessibility: string
  }
  refundStatus: string
  accountState: string
  shortcutItems: string[]
}

type AccountUserSeed = {
  email: string
  displayName: string
  password: string
}

type AccountSessionRecord = {
  token: string
  user_email: string
  expires_at: string
}

const fallbackAccountProfiles: Record<string, AccountPayload> = {
  default: {
    accountEmail: '',
    accountName: 'Customer',
    billingPortalUrl: '',
    paypalCheckoutUrl: process.env.PAYPAL_CHECKOUT_URL || '',
    paymentProcessorReady: true,
    paymentItems: [],
    paymentRequests: [],
    invoiceItems: [],
    receiptItems: [],
    supportContacts: [
      { label: 'Admin support email', value: 'Tw3y111@aol.com' },
      { label: 'Admin support phone', value: '410-905-9649' },
      { label: 'Owner contact email', value: 'Winfield.raekwon@yahoo.com' },
    ],
    preferences: {
      language: 'English',
      timeZone: 'Eastern Time',
      accessibility: 'Standard',
    },
    refundStatus: 'No refund requested yet.',
    accountState: 'Active',
    shortcutItems: ['Pay invoice', 'Request refund', 'Contact admin', 'Update payment method'],
  },
  'jordan.lee@example.com': {
    accountEmail: 'jordan.lee@example.com',
    accountName: 'Jordan Lee',
    billingPortalUrl: '',
    paypalCheckoutUrl: process.env.PAYPAL_CHECKOUT_URL || '',
    paymentProcessorReady: true,
    paymentItems: [],
    paymentRequests: [],
    invoiceItems: [],
    receiptItems: [],
    supportContacts: [
      { label: 'Admin support email', value: 'Tw3y111@aol.com' },
    ],
    preferences: {
      language: 'English',
      timeZone: 'Eastern Time',
      accessibility: 'Standard',
    },
    refundStatus: 'No refund requested yet.',
    accountState: 'Active',
    shortcutItems: ['Pay invoice', 'Request refund'],
  },
  'tammy.business@example.com': {
    accountEmail: 'tammy.business@example.com',
    accountName: 'Tammy',
    billingPortalUrl: '',
    paypalCheckoutUrl: process.env.PAYPAL_CHECKOUT_URL || '',
    paymentProcessorReady: true,
    paymentItems: [],
    paymentRequests: [],
    invoiceItems: [],
    receiptItems: [],
    supportContacts: [
      { label: 'Admin support email', value: 'Tw3y111@aol.com' },
      { label: 'Admin support phone', value: '410-905-9649' },
    ],
    preferences: {
      language: 'English',
      timeZone: 'Eastern Time',
      accessibility: 'Standard',
    },
    refundStatus: 'No refund requested yet.',
    accountState: 'Active',
    shortcutItems: ['Pay invoice', 'Request refund', 'Contact admin'],
  },
  'demo.customer@example.com': {
    accountEmail: 'demo.customer@example.com',
    accountName: 'Demo Customer',
    billingPortalUrl: '',
    paypalCheckoutUrl: process.env.PAYPAL_CHECKOUT_URL || '',
    paymentProcessorReady: true,
    paymentItems: [],
    paymentRequests: [],
    invoiceItems: [],
    receiptItems: [],
    supportContacts: [
      { label: 'Admin support email', value: 'Tw3y111@aol.com' },
      { label: 'Admin support phone', value: '410-905-9649' },
      { label: 'Owner contact email', value: 'Winfield.raekwon@yahoo.com' },
    ],
    preferences: {
      language: 'English',
      timeZone: 'Eastern Time',
      accessibility: 'High contrast',
    },
    refundStatus: 'No refund requested yet.',
    accountState: 'Active',
    shortcutItems: ['Pay invoice', 'Request refund', 'Contact admin', 'Update payment method'],
  },
}

const fallbackAccountData = fallbackAccountProfiles.default

const accountDbDir = path.join(process.cwd(), 'data')
const accountDbPath = path.join(accountDbDir, isTestEnvironment ? 'notconcrete-auth.test.sqlite' : 'notconcrete-auth.sqlite')
const accountSessionLifetimeMs = 1000 * 60 * 60 * 24 * 30
const accountUserSeeds: AccountUserSeed[] = [
  { email: 'jordan.lee@example.com', displayName: 'Jordan Lee', password: 'jordan123' },
  { email: 'tammy.business@example.com', displayName: 'Tammy', password: 'tammy123' },
  { email: 'demo.customer@example.com', displayName: 'Demo Customer', password: 'demo123' },
]

mkdirSync(accountDbDir, { recursive: true })

if (isTestEnvironment && existsSync(accountDbPath)) {
  unlinkSync(accountDbPath)
}

let accountDbPromise: Promise<Database> | null = null

const accountSchema = `
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS account_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    stripe_customer_id TEXT NOT NULL DEFAULT '',
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS account_sessions (
    token TEXT PRIMARY KEY,
    user_email TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS account_payment_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    confirmation_number TEXT NOT NULL UNIQUE,
    user_email TEXT NOT NULL,
    payment_method TEXT NOT NULL,
    amount TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL,
    admin_note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    verified_at TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS account_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    confirmation_number TEXT NOT NULL UNIQUE,
    checkout_session_id TEXT NOT NULL UNIQUE,
    payment_intent_id TEXT NOT NULL DEFAULT '',
    user_email TEXT NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'Stripe Checkout',
    amount TEXT NOT NULL,
    amount_cents INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'usd',
    note TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL,
    processor_status TEXT NOT NULL DEFAULT '',
    failure_reason TEXT NOT NULL DEFAULT '',
    receipt_url TEXT NOT NULL DEFAULT '',
    admin_note TEXT NOT NULL DEFAULT '',
    stripe_invoice_id TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS account_refund_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_email TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending',
    admin_note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at TEXT NOT NULL DEFAULT ''
  );

  CREATE INDEX IF NOT EXISTS idx_account_sessions_user_email ON account_sessions(user_email);
  CREATE INDEX IF NOT EXISTS idx_account_payment_requests_user_email ON account_payment_requests(user_email);
  CREATE INDEX IF NOT EXISTS idx_account_payment_requests_confirmation_number ON account_payment_requests(confirmation_number);
  CREATE INDEX IF NOT EXISTS idx_account_payments_user_email ON account_payments(user_email);
  CREATE INDEX IF NOT EXISTS idx_account_payments_confirmation_number ON account_payments(confirmation_number);
  CREATE INDEX IF NOT EXISTS idx_account_payments_checkout_session_id ON account_payments(checkout_session_id);
  CREATE INDEX IF NOT EXISTS idx_account_refund_requests_user_email ON account_refund_requests(user_email);
`

const accountQueryOne = (db: Database, sql: string, params: unknown[] = []) => {
  const result = db.exec(sql)

  if (!result[0] || result[0].values.length === 0) {
    return null
  }

  return Object.fromEntries(result[0].columns.map((column, index) => [column, result[0].values[0][index]])) as Record<string, unknown>
}

const accountQueryAll = (db: Database, sql: string) => {
  const result = db.exec(sql)

  if (!result[0]) {
    return [] as Record<string, unknown>[]
  }

  return result[0].values.map((row) => Object.fromEntries(result[0].columns.map((column, index) => [column, row[index]]))) as Record<string, unknown>[]
}

const accountRun = (db: Database, sql: string, params: unknown[] = []) => {
  db.exec(sql)
}

const escapeSqlLiteral = (value: string) => `'${value.replace(/'/g, "''")}'`

const paymentMethods: PaymentMethod[] = [
  'Apple Pay',
  'Debit card',
  'Credit card',
  'Direct deposit',
  'Zelle',
  'Cash App',
  'Venmo',
  'PayPal',
  'Cash',
  'Stripe Checkout',
]

const generateConfirmationNumber = () => `KC-${randomBytes(4).toString('hex').toUpperCase()}`

const parsePaymentAmount = (amount: string) => {
  const normalizedAmount = amount.replace(/[^0-9.,]/g, '').replace(/,/g, '')
  const parsedAmount = Number(normalizedAmount)

  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return null
  }

  return Math.round(parsedAmount * 100)
}

const formatPaymentAmount = (amountCents: number, currency: string) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amountCents / 100)

const getStripeConstructor = () => {
  // If we're in a test environment and a mock has been set globally, use it
  const mockStripe = (globalThis as any).__mockStripeConstructor
  if (mockStripe) {
    return mockStripe
  }

  const require = createRequire(import.meta.url)
  const stripeModule = require('stripe')
  // Handle both ESM (with __esModule flag) and CommonJS exports
  return stripeModule.default || stripeModule
}

const getStripeClient = () => {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY

  if (!stripeSecretKey) {
    throw new Error('Stripe is not configured')
  }

  try {
    const StripeConstructor = getStripeConstructor()
    
    if (typeof StripeConstructor !== 'function') {
      throw new Error(`Expected Stripe to be a constructor, got ${typeof StripeConstructor}`)
    }
    
    return new StripeConstructor(stripeSecretKey)
  } catch (error) {
    throw new Error(`Failed to initialize Stripe: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

const isStripeConfigured = () => {
  const isConfigured = Boolean(process.env.STRIPE_SECRET_KEY?.trim())
  if (!isConfigured) {
    console.warn('[isStripeConfigured] STRIPE_SECRET_KEY not found. Available env vars:', 
      Object.keys(process.env).filter(k => k.includes('STRIPE')).join(', ') || 'NONE')
  }
  return isConfigured
}

const getStripeWebhookSecret = () => process.env.STRIPE_WEBHOOK_SECRET || ''

const getPaymentReturnUrl = (sessionIdPlaceholder: string, result: 'success' | 'cancel', origin?: string) => {
  const publicUrl = origin || appPublicUrl
  return `${publicUrl}/account?checkout_session_id=${sessionIdPlaceholder}&checkout_result=${result}`
}

const persistAccountDb = (db: Database) => {
  writeFileSync(accountDbPath, Buffer.from(db.export()))
}

const seedAccountUsers = (db: Database) => {
  for (const user of accountUserSeeds) {
    const email = normalizeAccountEmail(user.email)
    const existing = accountQueryOne(db, `SELECT email FROM account_users WHERE email = ${escapeSqlLiteral(email)} LIMIT 1`)

    if (existing) {
      continue
    }

    const { hash, salt } = hashPassword(user.password)
    accountRun(db, `INSERT INTO account_users (email, display_name, password_hash, password_salt) VALUES (${escapeSqlLiteral(email)}, ${escapeSqlLiteral(user.displayName)}, ${escapeSqlLiteral(hash)}, ${escapeSqlLiteral(salt)})`)
  }
}

const createAccountUser = async (email: string, displayName: string, password: string) => {
  const db = await getAccountDb()
  const normalizedEmail = normalizeAccountEmail(email)
  const existingUser = accountQueryOne(db, `SELECT email FROM account_users WHERE email = ${escapeSqlLiteral(normalizedEmail)} LIMIT 1`)

  if (existingUser) {
    return null
  }

  const { hash, salt } = hashPassword(password)
  accountRun(
    db,
    `INSERT INTO account_users (email, display_name, password_hash, password_salt) VALUES (${escapeSqlLiteral(normalizedEmail)}, ${escapeSqlLiteral(displayName)}, ${escapeSqlLiteral(hash)}, ${escapeSqlLiteral(salt)})`,
  )
  persistAccountDb(db)

  return await getAccountUser(normalizedEmail)
}

const ensureAccountUserSchemaCompatibility = (db: Database) => {
  const columns = accountQueryAll(db, 'PRAGMA table_info(account_users)')
  const hasStripeCustomerId = columns.some((column) => String(column.name || '') === 'stripe_customer_id')

  if (!hasStripeCustomerId) {
    accountRun(db, "ALTER TABLE account_users ADD COLUMN stripe_customer_id TEXT NOT NULL DEFAULT ''")
  }
}

const mapPaymentRequestRecord = (request: Record<string, unknown>): AccountPaymentRequest => ({
  accountEmail: String(request.user_email || ''),
  confirmationNumber: String(request.confirmation_number || ''),
  paymentMethod: String(request.payment_method || '') as PaymentMethod,
  amount: String(request.amount || ''),
  note: String(request.note || ''),
  status: String(request.status || ''),
  adminNote: String(request.admin_note || ''),
  createdAt: String(request.created_at || ''),
  verifiedAt: String(request.verified_at || ''),
  checkoutSessionId: String(request.checkout_session_id || ''),
  paymentIntentId: String(request.payment_intent_id || ''),
  processorStatus: String(request.processor_status || ''),
  failureReason: String(request.failure_reason || ''),
  receiptUrl: String(request.receipt_url || ''),
  amountCents: Number(request.amount_cents || 0),
  currency: String(request.currency || 'usd'),
})

const mapStripePaymentRecord = (record: Record<string, unknown>): AccountPaymentRequest => ({
  accountEmail: String(record.user_email || ''),
  confirmationNumber: String(record.confirmation_number || ''),
  paymentMethod: String(record.payment_method || 'Stripe Checkout') as PaymentMethod,
  amount: String(record.amount || ''),
  note: String(record.note || ''),
  status: String(record.status || ''),
  adminNote: String(record.admin_note || ''),
  createdAt: String(record.created_at || ''),
  verifiedAt: String(record.confirmed_at || ''),
  checkoutSessionId: String(record.checkout_session_id || ''),
  paymentIntentId: String(record.payment_intent_id || ''),
  processorStatus: String(record.processor_status || ''),
  failureReason: String(record.failure_reason || ''),
  receiptUrl: String(record.receipt_url || ''),
  amountCents: Number(record.amount_cents || 0),
  currency: String(record.currency || 'usd'),
})

const findPaymentByCheckoutSessionId = async (checkoutSessionId: string) => {
  const db = await getAccountDb()
  const record = accountQueryOne(
    db,
    `SELECT confirmation_number, checkout_session_id, payment_intent_id, user_email, payment_method, amount, amount_cents, currency, note, status, processor_status, failure_reason, receipt_url, admin_note, created_at, updated_at, confirmed_at FROM account_payments WHERE checkout_session_id = ${escapeSqlLiteral(checkoutSessionId)} LIMIT 1`,
  )

  return record ? mapStripePaymentRecord(record) : null
}

const findPaymentByConfirmationNumber = async (confirmationNumber: string) => {
  const db = await getAccountDb()
  const record = accountQueryOne(
    db,
    `SELECT confirmation_number, checkout_session_id, payment_intent_id, user_email, payment_method, amount, amount_cents, currency, note, status, processor_status, failure_reason, receipt_url, admin_note, created_at, updated_at, confirmed_at FROM account_payments WHERE confirmation_number = ${escapeSqlLiteral(confirmationNumber)} LIMIT 1`,
  )

  return record ? mapStripePaymentRecord(record) : null
}

const getAccountPayments = async (email: string) => {
  const db = await getAccountDb()
  const records = accountQueryAll(
    db,
    `SELECT confirmation_number, checkout_session_id, payment_intent_id, user_email, payment_method, amount, amount_cents, currency, note, status, processor_status, failure_reason, receipt_url, admin_note, created_at, updated_at, confirmed_at FROM account_payments WHERE user_email = ${escapeSqlLiteral(normalizeAccountEmail(email))} ORDER BY datetime(created_at) DESC, id DESC`,
  )

  return records.map(mapStripePaymentRecord)
}

const getAllAccountPayments = async () => {
  const db = await getAccountDb()
  const records = accountQueryAll(
    db,
    'SELECT confirmation_number, checkout_session_id, payment_intent_id, user_email, payment_method, amount, amount_cents, currency, note, status, processor_status, failure_reason, receipt_url, admin_note, created_at, updated_at, confirmed_at FROM account_payments ORDER BY datetime(created_at) DESC, id DESC',
  )

  return records.map(mapStripePaymentRecord)
}

const upsertStripePaymentRecord = async (record: {
  email: string
  checkoutSessionId: string
  paymentIntentId: string
  paymentMethod: string
  amountCents: number
  currency: string
  note: string
  status: string
  processorStatus: string
  failureReason?: string
  receiptUrl?: string
  confirmedAt?: string
  stripeInvoiceId?: string
}) => {
  const db = await getAccountDb()
  const existing = accountQueryOne(
    db,
    `SELECT confirmation_number, checkout_session_id FROM account_payments WHERE checkout_session_id = ${escapeSqlLiteral(record.checkoutSessionId)} LIMIT 1`,
  )

  let confirmationNumber = String(existing?.confirmation_number || '')

  if (!confirmationNumber) {
    confirmationNumber = generateConfirmationNumber()

    while (accountQueryOne(db, `SELECT confirmation_number FROM account_payments WHERE confirmation_number = ${escapeSqlLiteral(confirmationNumber)} LIMIT 1`)) {
      confirmationNumber = generateConfirmationNumber()
    }
  }

  const amount = formatPaymentAmount(record.amountCents, record.currency)
  const confirmedAt = record.confirmedAt || (record.status === 'Succeeded' ? new Date().toISOString() : '')
  const failureReason = record.failureReason || ''
  const receiptUrl = record.receiptUrl || ''
  const paymentMethod = record.paymentMethod || 'Stripe Checkout'
  const stripeInvoiceId = record.stripeInvoiceId || ''

  if (existing) {
    accountRun(
      db,
      `UPDATE account_payments SET confirmation_number = ${escapeSqlLiteral(confirmationNumber || String(existing.confirmation_number || ''))}, payment_intent_id = ${escapeSqlLiteral(record.paymentIntentId)}, user_email = ${escapeSqlLiteral(normalizeAccountEmail(record.email))}, payment_method = ${escapeSqlLiteral(paymentMethod)}, amount = ${escapeSqlLiteral(amount)}, amount_cents = ${String(record.amountCents)}, currency = ${escapeSqlLiteral(record.currency)}, note = ${escapeSqlLiteral(record.note)}, status = ${escapeSqlLiteral(record.status)}, processor_status = ${escapeSqlLiteral(record.processorStatus)}, failure_reason = ${escapeSqlLiteral(failureReason)}, receipt_url = ${escapeSqlLiteral(receiptUrl)}, stripe_invoice_id = ${escapeSqlLiteral(stripeInvoiceId)}, updated_at = CURRENT_TIMESTAMP, confirmed_at = ${escapeSqlLiteral(confirmedAt)} WHERE checkout_session_id = ${escapeSqlLiteral(record.checkoutSessionId)}`,
    )
  } else {
    accountRun(
      db,
      `INSERT INTO account_payments (confirmation_number, checkout_session_id, payment_intent_id, user_email, payment_method, amount, amount_cents, currency, note, status, processor_status, failure_reason, receipt_url, stripe_invoice_id, admin_note, created_at, updated_at, confirmed_at) VALUES (${escapeSqlLiteral(confirmationNumber)}, ${escapeSqlLiteral(record.checkoutSessionId)}, ${escapeSqlLiteral(record.paymentIntentId)}, ${escapeSqlLiteral(normalizeAccountEmail(record.email))}, ${escapeSqlLiteral(paymentMethod)}, ${escapeSqlLiteral(amount)}, ${String(record.amountCents)}, ${escapeSqlLiteral(record.currency)}, ${escapeSqlLiteral(record.note)}, ${escapeSqlLiteral(record.status)}, ${escapeSqlLiteral(record.processorStatus)}, ${escapeSqlLiteral(failureReason)}, ${escapeSqlLiteral(receiptUrl)}, ${escapeSqlLiteral(stripeInvoiceId)}, '', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ${escapeSqlLiteral(confirmedAt)})`,
    )
  }

  persistAccountDb(db)

  return confirmationNumber
}

const createStripeInvoice = async (email: string, amountCents: number, currency: string, note: string): Promise<string> => {
  try {
    const stripe = getStripeClient()
    const customerId = await getOrCreateStripeCustomerId(email)
    
    // Create invoice with correct Stripe API calls
    const invoice = await (stripe as any).invoices.create({
      customer: customerId,
      currency: currency || 'usd',
      description: note || 'Cleaning service payment',
      auto_advance: false,
    })
    
    // Add line item to invoice
    await (stripe as any).invoiceItems.create({
      customer: customerId,
      invoice: invoice.id,
      amount: amountCents,
      currency: currency || 'usd',
      description: 'Cleaning service payment',
    })
    
    // Finalize the invoice
    await (stripe as any).invoices.finalizeInvoice(invoice.id)
    
    return invoice.id
  } catch (error) {
    console.error('Error creating Stripe invoice:', error)
    return ''
  }
}

const getStripeInvoicesForCustomer = async (email: string) => {
  try {
    const stripe = getStripeClient()
    const customerId = await getOrCreateStripeCustomerId(email)
    
    // Fetch all invoices for this customer
    const invoices = await (stripe as any).invoices.list({
      customer: customerId,
      limit: 100,
    })
    
    // Format invoices for the frontend
    return invoices.data.map((invoice: any) => ({
      id: invoice.id,
      number: invoice.number || 'INV-0000',
      total: `$${((invoice.total || 0) / 100).toFixed(2)}`,
      status: invoice.status === 'paid' ? 'Paid' : invoice.status === 'draft' ? 'Draft' : 'Open',
      url: invoice.pdf || '',
      createdAt: new Date(invoice.created * 1000).toISOString(),
      description: invoice.description || 'Cleaning service payment',
    }))
  } catch (error) {
    console.error('Error fetching Stripe invoices:', error)
    return []
  }
}

const reconcileStripeCheckoutSession = async (checkoutSession: StripeCheckoutSession) => {
  const checkoutSessionId = checkoutSession.id
  const paymentIntentId = typeof checkoutSession.payment_intent === 'string' ? checkoutSession.payment_intent : checkoutSession.payment_intent?.id || ''
  const email = String(checkoutSession.client_reference_id || checkoutSession.customer_details?.email || checkoutSession.metadata?.email || '')
  const amountCents = Number(checkoutSession.amount_total || 0)
  const currency = String(checkoutSession.currency || 'usd')
  const note = String(checkoutSession.metadata?.note || '')
  const paymentMethod = 'Stripe Checkout'
  const processorStatus = String(checkoutSession.payment_status || checkoutSession.status || 'pending')
  const status = checkoutSession.payment_status === 'paid' ? 'Succeeded' : checkoutSession.status === 'expired' ? 'Failed' : 'Pending'
  const failureReason = status === 'Failed' ? 'Checkout session expired or was not completed.' : ''
  const receiptUrl = ''

  const confirmationNumber = await upsertStripePaymentRecord({
    email,
    checkoutSessionId,
    paymentIntentId,
    paymentMethod,
    amountCents,
    currency,
    note,
    status,
    processorStatus,
    failureReason,
    receiptUrl,
    confirmedAt: status === 'Succeeded' ? new Date().toISOString() : '',
  })

  // Create Stripe invoice if payment succeeded
  let stripeInvoiceId = ''
  if (status === 'Succeeded') {
    stripeInvoiceId = await createStripeInvoice(email, amountCents, currency, note)
    
    // Update payment record with invoice ID
    if (stripeInvoiceId) {
      await upsertStripePaymentRecord({
        email,
        checkoutSessionId,
        paymentIntentId,
        paymentMethod,
        amountCents,
        currency,
        note,
        status,
        processorStatus,
        failureReason,
        receiptUrl,
        stripeInvoiceId,
        confirmedAt: new Date().toISOString(),
      })
    }
  }

  return {
    confirmationNumber,
    checkoutSessionId,
    paymentIntentId,
    status,
    processorStatus,
    failureReason,
  }
}

const createBillingPortalSession = async (email: string, origin: string) => {
  const stripe = getStripeClient()
  const customerId = await getOrCreateStripeCustomerId(email)
  const publicUrl = origin || appPublicUrl

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${publicUrl}/account`,
  })

  if (!session.url) {
    throw new Error('Billing portal session did not return a redirect URL')
  }

  return {
    url: session.url,
  }
}

const createStripeCheckoutSession = async (email: string, amountInput: string, note: string, origin?: string) => {
  const stripe = getStripeClient()
  const stripeCustomerId = await getOrCreateStripeCustomerId(email)
  const amountCents = parsePaymentAmount(amountInput)

  if (!amountCents) {
    throw new Error('Payment amount must be greater than zero')
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: 'payment',
    client_reference_id: normalizeAccountEmail(email),
    customer: stripeCustomerId,
    success_url: getPaymentReturnUrl('{CHECKOUT_SESSION_ID}', 'success', origin),
    cancel_url: getPaymentReturnUrl('{CHECKOUT_SESSION_ID}', 'cancel', origin),
    payment_method_types: ['card'],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: amountCents,
          product_data: {
            name: 'Cleaning service payment',
            description: note || 'Secure customer payment',
          },
        },
      },
    ],
    metadata: {
      email: normalizeAccountEmail(email),
      note: note.slice(0, 500),
      amount_cents: String(amountCents),
      currency: 'usd',
    },
    payment_intent_data: {
      metadata: {
        email: normalizeAccountEmail(email),
        note: note.slice(0, 500),
        amount_cents: String(amountCents),
        currency: 'usd',
      },
    },
  })

  if (!checkoutSession.url) {
    throw new Error('Stripe checkout session did not return a redirect URL')
  }

  await upsertStripePaymentRecord({
    email,
    checkoutSessionId: checkoutSession.id,
    paymentIntentId: typeof checkoutSession.payment_intent === 'string' ? checkoutSession.payment_intent : '',
    paymentMethod: 'Stripe Checkout',
    amountCents,
    currency: 'usd',
    note,
    status: 'Pending',
    processorStatus: String(checkoutSession.payment_status || checkoutSession.status || 'pending'),
    confirmedAt: '',
  })

  return {
    checkoutSessionId: checkoutSession.id,
    checkoutUrl: checkoutSession.url,
  }
}

const retrieveStripeCheckoutSession = async (checkoutSessionId: string) => {
  const stripe = getStripeClient()
  const checkoutSession = await stripe.checkout.sessions.retrieve(checkoutSessionId)

  return reconcileStripeCheckoutSession(checkoutSession)
}

const getAccountPaymentRequests = async (email: string) => {
  const db = await getAccountDb()
  const records = accountQueryAll(
    db,
    `SELECT confirmation_number, payment_method, amount, note, status, admin_note, created_at, verified_at FROM account_payment_requests WHERE user_email = ${escapeSqlLiteral(normalizeAccountEmail(email))} ORDER BY datetime(created_at) DESC, id DESC`,
  )

  return records.map(mapPaymentRequestRecord)
}

const getAllPaymentRequests = async () => {
  const db = await getAccountDb()
  const records = accountQueryAll(
    db,
    'SELECT confirmation_number, payment_method, amount, note, status, admin_note, created_at, verified_at FROM account_payment_requests ORDER BY datetime(created_at) DESC, id DESC',
  )

  return records.map(mapPaymentRequestRecord)
}

const createPaymentRequest = async (email: string, paymentMethod: PaymentMethod, amount: string, note: string) => {
  const db = await getAccountDb()
  let confirmationNumber = generateConfirmationNumber()

  while (accountQueryOne(db, `SELECT confirmation_number FROM account_payment_requests WHERE confirmation_number = ${escapeSqlLiteral(confirmationNumber)} LIMIT 1`)) {
    confirmationNumber = generateConfirmationNumber()
  }

  accountRun(
    db,
    `INSERT INTO account_payment_requests (confirmation_number, user_email, payment_method, amount, note, status, admin_note, verified_at) VALUES (${escapeSqlLiteral(confirmationNumber)}, ${escapeSqlLiteral(normalizeAccountEmail(email))}, ${escapeSqlLiteral(paymentMethod)}, ${escapeSqlLiteral(amount)}, ${escapeSqlLiteral(note)}, 'Pending', '', '')`,
  )
  persistAccountDb(db)

  return {
    accountEmail: email,
    confirmationNumber,
    paymentMethod,
    amount,
    note,
    status: 'Pending',
    adminNote: '',
    createdAt: new Date().toISOString(),
    verifiedAt: '',
  } satisfies AccountPaymentRequest
}

const verifyPaymentRequest = async (confirmationNumber: string, adminNote: string) => {
  const db = await getAccountDb()
  const request = accountQueryOne(
    db,
    `SELECT confirmation_number, payment_method, amount, note, status, admin_note, created_at, verified_at FROM account_payment_requests WHERE confirmation_number = ${escapeSqlLiteral(confirmationNumber)} LIMIT 1`,
  )

  if (!request) {
    return null
  }

  if (String(request.status || '') !== 'Verified') {
    accountRun(
      db,
      `UPDATE account_payment_requests SET status = 'Verified', admin_note = ${escapeSqlLiteral(adminNote)}, verified_at = CURRENT_TIMESTAMP WHERE confirmation_number = ${escapeSqlLiteral(confirmationNumber)}`,
    )
    persistAccountDb(db)
  } else if (adminNote && adminNote !== String(request.admin_note || '')) {
    accountRun(
      db,
      `UPDATE account_payment_requests SET admin_note = ${escapeSqlLiteral(adminNote)} WHERE confirmation_number = ${escapeSqlLiteral(confirmationNumber)}`,
    )
    persistAccountDb(db)
  }

  const updatedRequest = accountQueryOne(
    db,
    `SELECT confirmation_number, payment_method, amount, note, status, admin_note, created_at, verified_at FROM account_payment_requests WHERE confirmation_number = ${escapeSqlLiteral(confirmationNumber)} LIMIT 1`,
  )

  return updatedRequest ? mapPaymentRequestRecord(updatedRequest) : null
}

const initializeAccountDb = async () => {
  const wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm')
  const SQL = await initSqlJs({ locateFile: () => wasmPath })
  const db = existsSync(accountDbPath) ? new SQL.Database(readFileSync(accountDbPath)) : new SQL.Database()

  db.exec(accountSchema)
  ensureAccountUserSchemaCompatibility(db)
  seedAccountUsers(db)
  persistAccountDb(db)

  return db
}

const getAccountDb = async () => {
  if (!accountDbPromise) {
    accountDbPromise = initializeAccountDb()
  }

  return accountDbPromise
}

const getFallbackAccountProfile = (email: string) => {
  const normalizedEmail = email.trim().toLowerCase()
  return fallbackAccountProfiles[normalizedEmail] ?? {
    ...fallbackAccountProfiles.default,
    accountEmail: normalizedEmail,
    accountName: normalizedEmail ? normalizedEmail.split('@')[0].replace(/[._-]+/g, ' ') : fallbackAccountProfiles.default.accountName,
  }
}

const normalizeAccountEmail = (email: string) => email.trim().toLowerCase()

const getAccountUser = async (email: string) => {
  const db = await getAccountDb()
  return accountQueryOne(db, `SELECT * FROM account_users WHERE email = ${escapeSqlLiteral(normalizeAccountEmail(email))} LIMIT 1`) as
    | {
        email: string
        display_name: string
        stripe_customer_id: string
        password_hash: string
        password_salt: string
      }
    | null
}

const getAccountProfile = async (email: string) => {
  const normalizedEmail = normalizeAccountEmail(email)
  const user = await getAccountUser(normalizedEmail)
  const fallbackProfile = getFallbackAccountProfile(normalizedEmail)

  return {
    ...fallbackProfile,
    accountEmail: normalizedEmail,
    accountName: user?.display_name || fallbackProfile.accountName,
  }
}

const updateAccountStripeCustomerId = async (email: string, stripeCustomerId: string) => {
  const db = await getAccountDb()
  accountRun(
    db,
    `UPDATE account_users SET stripe_customer_id = ${escapeSqlLiteral(stripeCustomerId)}, updated_at = CURRENT_TIMESTAMP WHERE email = ${escapeSqlLiteral(normalizeAccountEmail(email))}`,
  )
  persistAccountDb(db)
}

const getOrCreateStripeCustomerId = async (email: string) => {
  const normalizedEmail = normalizeAccountEmail(email)
  const user = await getAccountUser(normalizedEmail)

  if (user?.stripe_customer_id) {
    return user.stripe_customer_id
  }

  const stripe = getStripeClient()
  const stripeCustomer = await stripe.customers.create({
    email: normalizedEmail,
    name: user?.display_name || normalizedEmail,
    metadata: {
      account_email: normalizedEmail,
    },
  })

  await updateAccountStripeCustomerId(normalizedEmail, stripeCustomer.id)
  return stripeCustomer.id
}

const updateAccountUserPassword = async (email: string, password: string) => {
  const db = await getAccountDb()
  const { hash, salt } = hashPassword(password)

  accountRun(
    db,
    `UPDATE account_users SET password_hash = ${escapeSqlLiteral(hash)}, password_salt = ${escapeSqlLiteral(salt)}, updated_at = CURRENT_TIMESTAMP WHERE email = ${escapeSqlLiteral(normalizeAccountEmail(email))}`,
  )
  persistAccountDb(db)
}

const createAccountSessionToken = () => randomBytes(24).toString('hex')

const createAccountSession = async (email: string) => {
  const db = await getAccountDb()
  const token = createAccountSessionToken()
  const expiresAt = new Date(Date.now() + accountSessionLifetimeMs).toISOString()

  accountRun(
    db,
    `INSERT INTO account_sessions (token, user_email, expires_at) VALUES (${escapeSqlLiteral(token)}, ${escapeSqlLiteral(normalizeAccountEmail(email))}, ${escapeSqlLiteral(expiresAt)})`,
  )
  persistAccountDb(db)

  return token
}

const deleteAccountSession = async (token: string) => {
  const db = await getAccountDb()
  accountRun(db, `DELETE FROM account_sessions WHERE token = ${escapeSqlLiteral(token)}`)
  persistAccountDb(db)
}

const getAuthorizedAccountEmail = async (req: express.Request) => {
  const authHeader = req.headers.authorization
  const token = authHeader?.replace('Bearer ', '').trim()

  if (!token) {
    return ''
  }

  const db = await getAccountDb()
  const session = accountQueryOne(db, `SELECT token, user_email, expires_at FROM account_sessions WHERE token = ${escapeSqlLiteral(token)} LIMIT 1`) as AccountSessionRecord | null

  if (!session) {
    return ''
  }

  if (new Date(session.expires_at).getTime() <= Date.now()) {
    accountRun(db, `DELETE FROM account_sessions WHERE token = ${escapeSqlLiteral(token)}`)
    persistAccountDb(db)
    return ''
  }

  return session.user_email
}

app.use((req, res, next) => {
  const forwardedProto = String(req.headers['x-forwarded-proto'] ?? '').split(',')[0].trim().toLowerCase()
  const isSecureRequest = req.secure || forwardedProto === 'https'

  if (shouldRedirectHttp && !isSecureRequest) {
    const host = req.headers.host || `localhost:${port}`
    const location = `https://${host}${req.originalUrl}`
    res.setHeader('Cache-Control', 'no-store')
    res.redirect(301, location)
    return
  }

  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "object-src 'none'",
    "img-src 'self' data: https:",
    "style-src 'self' 'unsafe-inline'",
    `connect-src ${secureConnectSrc}`,
    "script-src 'self'",
  ].join('; '))

  if (shouldEnableHsts && isSecureRequest) {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains')
  }

  next()
})

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

const normalizeBodyString = (value: unknown) => String(value ?? '').replace(/\u0000/g, '').trim()

const validateRequiredBodyFields = (
  body: Record<string, unknown>,
  fields: Array<{ name: string; maxLength: number }>,
) => {
  const safeBody = body ?? {}
  const missing: string[] = []
  const tooLong: string[] = []

  for (const field of fields) {
    const value = normalizeBodyString(safeBody[field.name])

    if (!value) {
      missing.push(field.name)
      continue
    }

    if (value.length > field.maxLength) {
      tooLong.push(field.name)
    }
  }

  return { missing, tooLong }
}

app.get('/api/site', async (_req, res) => {
  try {
    const services = await supabaseSelect('services', { order: 'featured.desc,sort_order.asc' })
    const testimonials = await supabaseSelect('testimonials', { order: 'sort_order.asc' })
    const rawGallery = await supabaseSelect('gallery_items', { order: 'sort_order.asc' })
    const serviceAreas = await supabaseSelect('service_areas', { order: 'sort_order.asc' })

    const gallery = Array.isArray(rawGallery)
      ? rawGallery.map((item) => normalizeGalleryItem(item as Record<string, unknown>))
      : []

    res.json({
      services: services || [],
      testimonials: testimonials || [],
      gallery,
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
    const quotes = await supabaseSelect('quote_requests', { order: 'created_at.desc' })
    res.json({ quotes: quotes || [] })
  } catch (error) {
    console.error('Error fetching quotes:', error)
    res.status(500).json({ message: 'Failed to fetch quotes' })
  }
})

app.get('/api/account', async (req, res) => {
  try {
    const email = String(req.query.email || '').trim().toLowerCase()
    const profile = email ? getFallbackAccountProfile(email) : fallbackAccountData
    res.json({ ...profile, paymentRequests: [] })
  } catch (error) {
    console.error('Error fetching account data:', error)
    res.status(500).json({ message: 'Failed to fetch account data' })
  }
})

app.post('/api/account/sign-in', async (req, res) => {
  const body = req.body as Record<string, unknown>
  const email = String(body.email || '').trim().toLowerCase()
  const password = String(body.password || '').trim()

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' })
  }

  const user = await getAccountUser(email)

  if (!user) {
    return res.status(401).json({ message: 'Invalid email or password' })
  }

  const isValid = verifyPassword(password, user.password_hash, user.password_salt)

  if (!isValid) {
    return res.status(401).json({ message: 'Invalid email or password' })
  }

  const token = await createAccountSession(email)

  res.json({ ok: true, token, accountEmail: email })
})

app.post('/api/account/sign-up', async (req, res) => {
  const body = req.body as Record<string, unknown>
  const email = String(body.email || '').trim().toLowerCase()
  const displayName = String(body.displayName || '').trim()
  const password = String(body.password || '').trim()
  const confirmPassword = String(body.confirmPassword || '').trim()

  if (!email || !displayName || !password || !confirmPassword) {
    return res.status(400).json({ message: 'Display name, email, and password are required' })
  }

  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' })
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ message: 'Passwords do not match' })
  }

  const user = await createAccountUser(email, displayName, password)

  if (!user) {
    return res.status(409).json({ message: 'An account already exists for that email' })
  }

  const token = await createAccountSession(email)

  res.status(201).json({ ok: true, token, accountEmail: email, accountName: user.display_name })
})

app.post('/api/account/sign-out', async (req, res) => {
  const body = req.body as Record<string, unknown>
  const token = String(body.token || '').trim()

  if (!token) {
    return res.status(400).json({ message: 'Session token is required' })
  }

  await deleteAccountSession(token)
  res.json({ ok: true })
})

app.patch('/api/account/password', async (req, res) => {
  const email = await getAuthorizedAccountEmail(req)

  if (!email) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  const body = req.body as Record<string, unknown>
  const currentPassword = String(body.currentPassword || '').trim()
  const newPassword = String(body.newPassword || '').trim()
  const confirmPassword = String(body.confirmPassword || '').trim()

  if (!currentPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({ message: 'All password fields are required' })
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'New password must be at least 6 characters' })
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ message: 'Passwords do not match' })
  }

  const user = await getAccountUser(email)

  if (!user) {
    return res.status(404).json({ message: 'Account not found' })
  }

  const isCurrentPasswordValid = verifyPassword(currentPassword, user.password_hash, user.password_salt)

  if (!isCurrentPasswordValid) {
    return res.status(401).json({ message: 'Current password is incorrect' })
  }

  await updateAccountUserPassword(email, newPassword)
  res.json({ ok: true })
})

app.get('/api/account/me', async (req, res) => {
  try {
    // Prevent browser caching for account data - always return fresh
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.set('Pragma', 'no-cache')
    res.set('Expires', '0')
    
    const email = await getAuthorizedAccountEmail(req)

    if (!email) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const profile = await getAccountProfile(email)
    const paymentRequests = await getAccountPayments(email)
    res.json({ ...profile, paymentProcessorReady: isStripeConfigured(), billingPortalReady: isStripeConfigured(), paymentRequests })
  } catch (error) {
    console.error('Error fetching signed-in account data:', error)
    res.status(500).json({ message: 'Failed to fetch account data' })
  }
})

app.get('/api/account/payment-requests', async (req, res) => {
  try {
    const email = await getAuthorizedAccountEmail(req)

    if (!email) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const paymentRequests = await getAccountPaymentRequests(email)
    res.json({ paymentRequests })
  } catch (error) {
    console.error('Error fetching payment requests:', error)
    res.status(500).json({ message: 'Failed to fetch payment requests' })
  }
})

app.get('/api/account/invoices', async (req, res) => {
  try {
    // Prevent browser caching for invoice data - always return fresh
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.set('Pragma', 'no-cache')
    res.set('Expires', '0')
    
    const email = await getAuthorizedAccountEmail(req)

    if (!email) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    if (!isStripeConfigured()) {
      return res.json({ invoices: [] })
    }

    const invoices = await getStripeInvoicesForCustomer(email)
    res.json({ invoices })
  } catch (error) {
    console.error('Error fetching invoices:', error)
    res.status(500).json({ message: 'Failed to fetch invoices' })
  }
})

app.get('/api/account/refund-status', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.set('Pragma', 'no-cache')
    res.set('Expires', '0')

    const email = await getAuthorizedAccountEmail(req)

    if (!email) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const db = await getAccountDb()
    const refunds = accountQueryAll(
      db,
      `SELECT id, reason, status, admin_note, created_at, updated_at FROM account_refund_requests WHERE user_email = ${escapeSqlLiteral(email)} ORDER BY created_at DESC`,
    ) as Array<{
      id: number
      reason: string
      status: string
      admin_note: string
      created_at: string
      updated_at: string
    }>

    res.json({ refunds })
  } catch (error) {
    console.error('Error fetching refund status:', error)
    res.status(500).json({ message: 'Failed to fetch refund status' })
  }
})

app.post('/api/account/payment-requests', async (req, res) => {
  try {
    const email = await getAuthorizedAccountEmail(req)

    if (!email) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const body = req.body as Record<string, unknown>
    const paymentMethod = normalizeBodyString(body.paymentMethod) as PaymentMethod
    const amount = normalizeBodyString(body.amount)
    const note = normalizeBodyString(body.note)

    if (!paymentMethods.includes(paymentMethod)) {
      return res.status(400).json({ message: 'Select a valid payment method' })
    }

    if (!amount) {
      return res.status(400).json({ message: 'Payment amount is required' })
    }

    if (amount.length > 50) {
      return res.status(400).json({ message: 'Payment amount is too long' })
    }

    if (note.length > 1000) {
      return res.status(400).json({ message: 'Payment note is too long' })
    }

    const paymentRequest = await createPaymentRequest(email, paymentMethod, amount, note)
    res.status(201).json({ ok: true, paymentRequest })
  } catch (error) {
    console.error('Error creating payment request:', error)
    res.status(500).json({ message: 'Failed to create payment request' })
  }
})

app.post('/api/account/billing-portal/session', async (req, res) => {
  try {
    const email = await getAuthorizedAccountEmail(req)

    if (!email) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    if (!isStripeConfigured()) {
      return res.status(503).json({ message: 'Stripe is not configured on the server' })
    }

    // Get the public URL from the request origin or headers
    const protocol = req.get('x-forwarded-proto') || req.protocol
    const host = req.get('x-forwarded-host') || req.get('host')
    const origin = `${protocol}://${host}`

    const portalSession = await createBillingPortalSession(email, origin)
    res.status(201).json({ ok: true, ...portalSession })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create billing portal session'
    console.error('Error creating billing portal session:', error)
    res.status(500).json({ message })
  }
})

app.post('/api/account/payments/checkout-session', async (req, res) => {
  try {
    const email = await getAuthorizedAccountEmail(req)

    if (!email) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const body = req.body as Record<string, unknown>
    const amount = normalizeBodyString(body.amount)
    const note = normalizeBodyString(body.note)

    if (!amount) {
      return res.status(400).json({ message: 'Payment amount is required' })
    }

    if (note.length > 1000) {
      return res.status(400).json({ message: 'Payment note is too long' })
    }

    // Get the public URL from the request origin or headers
    const protocol = req.get('x-forwarded-proto') || req.protocol
    const host = req.get('x-forwarded-host') || req.get('host')
    const origin = `${protocol}://${host}`

    const payment = await createStripeCheckoutSession(email, amount, note, origin)
    res.status(201).json({ ok: true, payment })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to start checkout'

    if (message === 'Stripe is not configured') {
      return res.status(503).json({ message: 'Stripe is not configured on the server' })
    }

    console.error('Error creating checkout session:', error)
    res.status(500).json({ message: 'Failed to start checkout' })
  }
})

app.get('/api/account/payments/session/:checkoutSessionId', async (req, res) => {
  try {
    const email = await getAuthorizedAccountEmail(req)

    if (!email) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const checkoutSessionId = normalizeBodyString(req.params.checkoutSessionId)

    if (!checkoutSessionId) {
      return res.status(400).json({ message: 'Checkout session is required' })
    }

    const payment = await findPaymentByCheckoutSessionId(checkoutSessionId)

    if (!payment || normalizeAccountEmail(payment.accountEmail) !== normalizeAccountEmail(email)) {
      return res.status(404).json({ message: 'Payment not found' })
    }

    try {
      const refreshedPayment = await retrieveStripeCheckoutSession(checkoutSessionId)
      return res.json({ payment: refreshedPayment })
    } catch {
      return res.json({ payment })
    }
  } catch (error) {
    console.error('Error fetching checkout session status:', error)
    res.status(500).json({ message: 'Failed to fetch payment status' })
  }
})

app.post('/api/stripe/webhook', async (req, res) => {
  const stripeWebhookSecret = getStripeWebhookSecret()

  if (!stripeWebhookSecret) {
    return res.status(503).json({ message: 'Stripe webhook secret is not configured' })
  }

  try {
    const stripe = getStripeClient()
    const signature = String(req.headers['stripe-signature'] || '')

    if (!signature) {
      return res.status(400).json({ message: 'Stripe signature is required' })
    }

    const rawBody = (req as express.Request & { rawBody?: Buffer }).rawBody || Buffer.from(JSON.stringify(req.body || {}))
    const event = stripe.webhooks.constructEvent(rawBody, signature, stripeWebhookSecret)

    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.expired') {
      const checkoutSession = event.data.object as StripeCheckoutSession
      const result = await reconcileStripeCheckoutSession(checkoutSession)
      res.json({ received: true, payment: result })
      return
    }

    res.json({ received: true })
  } catch (error) {
    console.error('Stripe webhook error:', error)
    res.status(400).json({ message: 'Invalid Stripe webhook' })
  }
})

app.get('/api/admin/payment-requests', checkAdminAuth, async (req, res) => {
  const password = res.locals.adminPassword as string
  const isValid = await verifyAdminPassword(password)

  if (!isValid) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  try {
    const paymentRequests = await getAllAccountPayments()
    res.json({ paymentRequests })
  } catch (error) {
    console.error('Error fetching payment requests:', error)
    res.status(500).json({ message: 'Failed to fetch payment requests' })
  }
})

app.post('/api/admin/payment-requests/verify', checkAdminAuth, async (req, res) => {
  const password = res.locals.adminPassword as string
  const isValid = await verifyAdminPassword(password)

  if (!isValid) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  const body = req.body as Record<string, unknown>
  const confirmationNumber = normalizeBodyString(body.confirmationNumber)
  const adminNote = normalizeBodyString(body.adminNote)

  if (!confirmationNumber) {
    return res.status(400).json({ message: 'Confirmation number is required' })
  }

  try {
    const paymentRequest = await verifyPaymentRequest(confirmationNumber, adminNote)

    if (!paymentRequest) {
      return res.status(404).json({ message: 'Payment request not found' })
    }

    res.json({ ok: true, paymentRequest })
  } catch (error) {
    console.error('Error verifying payment request:', error)
    res.status(500).json({ message: 'Failed to verify payment request' })
  }
})

app.post('/api/account/refunds', async (req, res) => {
  try {
    const email = await getAuthorizedAccountEmail(req)
    if (!email) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const body = req.body as Record<string, unknown>
    const reason = normalizeBodyString(body.reason)

    if (!reason) {
      return res.status(400).json({ message: 'Refund reason is required' })
    }

    if (reason.length > 2000) {
      return res.status(400).json({ message: 'Refund reason is too long' })
    }

    // Store refund request in database
    const db = await getAccountDb()
    accountRun(
      db,
      `INSERT INTO account_refund_requests (user_email, reason, status) VALUES (${escapeSqlLiteral(email)}, ${escapeSqlLiteral(reason)}, 'Pending')`,
    )
    persistAccountDb(db)

    res.status(201).json({ ok: true, refundStatus: 'Under review' })
  } catch (error) {
    console.error('Error processing refund request:', error)
    res.status(500).json({ message: 'Failed to process refund request' })
  }
})

app.get('/api/admin/feedback', checkAdminAuth, async (req, res) => {
  const password = res.locals.adminPassword as string
  const isValid = await verifyAdminPassword(password)
  if (!isValid) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  try {
    const feedback = await supabaseSelect('feedback_messages', { order: 'created_at.desc' })
    res.json({ feedback: feedback || [] })
  } catch (error) {
    console.error('Error fetching admin feedback:', error)
    res.json({ feedback: fallbackData.feedback || [] })
  }
})

app.get('/api/admin/refund-requests', checkAdminAuth, async (req, res) => {
  try {
    const password = res.locals.adminPassword as string
    const isValid = await verifyAdminPassword(password)
    if (!isValid) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const db = await getAccountDb()
    const refunds = accountQueryAll(
      db,
      `SELECT id, user_email, reason, status, admin_note, created_at, updated_at, resolved_at FROM account_refund_requests ORDER BY created_at DESC`,
    ) as Array<{
      id: number
      user_email: string
      reason: string
      status: string
      admin_note: string
      created_at: string
      updated_at: string
      resolved_at: string
    }>

    res.json({ refunds })
  } catch (error) {
    console.error('Error fetching refund requests:', error)
    res.status(500).json({ message: 'Failed to fetch refund requests' })
  }
})

app.post('/api/admin/refund-requests/:id/update-status', checkAdminAuth, async (req, res) => {
  try {
    const password = res.locals.adminPassword as string
    const isValid = await verifyAdminPassword(password)
    if (!isValid) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const { id } = req.params
    const body = req.body as Record<string, unknown>
    const status = normalizeBodyString(body.status as string)
    const adminNote = normalizeBodyString(body.adminNote as string)

    if (!['Pending', 'Approved', 'Rejected', 'Refunded'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' })
    }

    const db = await getAccountDb()
    const resolvedAt = ['Approved', 'Rejected', 'Refunded'].includes(status) ? new Date().toISOString() : ''

    accountRun(
      db,
      `UPDATE account_refund_requests SET status = ${escapeSqlLiteral(status)}, admin_note = ${escapeSqlLiteral(adminNote)}, updated_at = CURRENT_TIMESTAMP, resolved_at = ${escapeSqlLiteral(resolvedAt)} WHERE id = ${id}`,
    )
    persistAccountDb(db)

    res.json({ ok: true })
  } catch (error) {
    console.error('Error updating refund status:', error)
    res.status(500).json({ message: 'Failed to update refund status' })
  }
})

app.post('/api/quotes', async (req, res) => {
  const body = req.body as Record<string, string | undefined>
  const requiredFields = [
    { name: 'fullName', maxLength: 100 },
    { name: 'phone', maxLength: 50 },
    { name: 'email', maxLength: 254 },
    { name: 'serviceType', maxLength: 120 },
    { name: 'propertyType', maxLength: 120 },
    { name: 'address', maxLength: 255 },
    { name: 'details', maxLength: 4000 },
  ]

  const { missing, tooLong } = validateRequiredBodyFields(body, requiredFields)

  if (missing.length > 0) {
    res.status(400).json({ message: `Missing required fields: ${missing.join(', ')}` })
    return
  }

  if (tooLong.length > 0) {
    res.status(400).json({ message: `Fields too long: ${tooLong.join(', ')}` })
    return
  }

  try {
    await supabaseInsert('quote_requests', {
      full_name: normalizeBodyString(body.fullName),
      phone: normalizeBodyString(body.phone),
      email: normalizeBodyString(body.email),
      service_type: normalizeBodyString(body.serviceType),
      property_type: normalizeBodyString(body.propertyType),
      address: normalizeBodyString(body.address),
      preferred_date: normalizeBodyString(body.preferredDate) || null,
      details: normalizeBodyString(body.details),
    })
    res.status(201).json({ ok: true })
  } catch (error) {
    console.error('Error creating quote:', error)
    res.status(500).json({ message: 'Failed to create quote' })
  }
})

app.post('/api/feedback', async (req, res) => {
  const body = req.body as Record<string, string | undefined>
  const requiredFields = [
    { name: 'name', maxLength: 100 },
    { name: 'email', maxLength: 254 },
    { name: 'rating', maxLength: 2 },
    { name: 'message', maxLength: 4000 },
  ]

  const { missing, tooLong } = validateRequiredBodyFields(body, requiredFields)

  if (missing.length > 0) {
    return res.status(400).json({ message: `Missing required fields: ${missing.join(', ')}` })
  }

  if (tooLong.length > 0) {
    return res.status(400).json({ message: `Fields too long: ${tooLong.join(', ')}` })
  }

  try {
    await supabaseInsert('feedback_messages', {
      name: normalizeBodyString(body.name),
      email: normalizeBodyString(body.email),
      rating: normalizeBodyString(body.rating),
      message: normalizeBodyString(body.message),
      reviewed: false,
    })

    res.status(201).json({ ok: true })
  } catch (error) {
    console.error('Error creating feedback:', error)
    const fallbackList = fallbackData.feedback as FeedbackRecord[]
    fallbackList.unshift({
      id: Date.now(),
      name: String(body.name || '').trim(),
      email: String(body.email || '').trim(),
      rating: String(body.rating || '5').trim(),
      message: String(body.message || '').trim(),
      reviewed: false,
      created_at: new Date().toISOString(),
    })
    res.status(201).json({ ok: true, fallback: true })
  }
})

// Admin authentication middleware
function checkAdminAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
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

export { app, getStripeConstructor }

if (!isTestEnvironment) {
  // Log environment variable status for debugging
  console.log('[Server Startup] Environment Variables Status:')
  console.log(`  STRIPE_SECRET_KEY: ${process.env.STRIPE_SECRET_KEY ? '✓ SET' : '✗ MISSING'}`)
  console.log(`  STRIPE_WEBHOOK_SECRET: ${process.env.STRIPE_WEBHOOK_SECRET ? '✓ SET' : '✗ MISSING'}`)
  console.log(`  PAYPAL_CHECKOUT_URL: ${process.env.PAYPAL_CHECKOUT_URL ? '✓ SET' : '✗ MISSING'}`)
  console.log(`  NODE_ENV: ${process.env.NODE_ENV}`)
  
  app.listen(port, () => {
    console.log(`Not Concrete Cleaning Co. API running on http://localhost:${port}`)
  })
}
