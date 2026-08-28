// scripts/test-mongodb-connection.js
// Quick connection test for a MongoDB Atlas URL provided via env var or argument.
const { MongoClient } = require('mongodb')

const url = process.argv[2] || process.env.TEST_MONGODB_URL
if (!url) {
  console.error('Usage: node scripts/test-mongodb-connection.js "mongodb+srv://..."')
  process.exit(1)
}

  ; (async () => {
    console.log('[test] URL:', url.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@'))
    const client = new MongoClient(url, { serverSelectionTimeoutMS: 10000 })
    try {
      await client.connect()
      console.log('[test] ✅ Connected successfully!')
      const admin = client.db('admin')
      const ping = await admin.command({ ping: 1 })
      console.log('[test] Ping response:', JSON.stringify(ping))

      // Try to access attendance_db
      const attendanceDb = client.db('attendance_db')
      const collections = await attendanceDb.listCollections().toArray()
      console.log('[test] Collections in attendance_db:', collections.length === 0 ? '(none yet — will be created)' : collections.map(c => c.name))

      // Try a write (create collection implicitly)
      const testCol = attendanceDb.collection('_connection_test')
      await testCol.insertOne({ test: true, createdAt: new Date() })
      console.log('[test] ✅ Write test passed — collections can be created')

      // Clean up the test doc
      await testCol.deleteMany({})
      console.log('[test] Cleaned up test document')
    } catch (err) {
      console.error('[test] ❌ Connection failed:', err.message)
      process.exit(1)
    } finally {
      await client.close()
    }
  })()
