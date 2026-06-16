import { Pool } from 'pg'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

async function testConnection() {
  try {
    console.log('🔍 Testing Supabase connection...')
    console.log(`Database URL: ${process.env.DATABASE_URL?.substring(0, 50)}...`)

    const client = await pool.connect()
    console.log('✅ Connected to Supabase!')

    // Test basic query
    const result = await client.query('SELECT NOW()')
    console.log('✅ Database is responsive')
    console.log('Current server time:', result.rows[0].now)

    // Check if tables exist
    const tableCheck = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public'
    `)
    console.log('📊 Existing tables:', tableCheck.rows.map(r => r.table_name))

    client.release()
    await pool.end()

    console.log('\n✨ Supabase is ready! You can now remove fallback data if desired.')
  } catch (error) {
    console.error('❌ Connection failed:', error)
    console.log('\n📋 To set up Supabase:')
    console.log('1. Go to https://supabase.com')
    console.log('2. Create a new project (free tier available)')
    console.log('3. Get the database connection URL from Project Settings > Database')
    console.log('4. Update .env.local with DATABASE_URL')
    console.log('5. Re-run this test')
    process.exit(1)
  }
}

testConnection()
