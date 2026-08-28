// src/lib/mongo-data-api.ts
// MongoDB Atlas Data API client — works over plain HTTPS, no driver needed.
// This bypasses ALL the issues we've seen:
//   - No TLS handshake (plain HTTPS on port 443)
//   - No IP allowlist needed (Data API is publicly accessible)
//   - No driver cold start (just fetch())
//   - No Vercel function timeout issues (each request < 1s)
//
// To enable Data API on your MongoDB Atlas cluster:
//   1. Go to Atlas → Cluster → "Data API" tab
//   2. Click "Enable Data API"
//   3. Copy the URL (e.g. https://data.mongodb-api.com/app/xxx/endpoint/data/v1)
//   4. Create an API key (Atlas → Access Manager → API Keys → "Create API Key")
//   5. Add the key as a data source in the Data API tab
//
// Then set these env vars on Vercel:
//   MONGODB_DATA_API_URL=https://data.mongodb-api.com/app/xxx/endpoint/data/v1
//   MONGODB_DATA_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxx

const API_URL = process.env.MONGODB_DATA_API_URL
const API_KEY = process.env.MONGODB_DATA_API_KEY
const DATA_SOURCE = process.env.MONGODB_DATA_SOURCE || 'Cluster0'
const DATABASE = process.env.MONGODB_DATABASE || 'attendance_db'

interface DataApiResponse {
  document?: Record<string, unknown>
  documents?: Record<string, unknown>[]
  insertedId?: string
  insertedIds?: string[]
  matchedCount?: number
  modifiedCount?: number
  deletedCount?: number
  error?: string
  errorCode?: string
}

async function dataApiCall(action: string, body: Record<string, unknown>): Promise<DataApiResponse> {
  if (!API_URL || !API_KEY) {
    throw new Error('MONGODB_DATA_API_URL أو MONGODB_DATA_API_KEY غير مضبوط')
  }

  const res = await fetch(`${API_URL}/action/${action}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Request-Headers': '*',
      'api-key': API_KEY,
    },
    body: JSON.stringify({
      dataSource: DATA_SOURCE,
      database: DATABASE,
      ...body,
    }),
  })

  const data = await res.json().catch(() => ({ error: 'استجابة غير صالحة من Data API' }))

  if (!res.ok) {
    throw new Error(`Data API error (${res.status}): ${data.error || data.errorCode || 'Unknown'}`)
  }

  return data as DataApiResponse
}

// Convert _id (string in body, ObjectId in DB)
function withObjectIdFilter(filter: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...filter }
  if (result._id && typeof result._id === 'string') {
    result._id = { $oid: result._id }
  }
  return result
}

export const dataApi = {
  isConfigured: () => !!API_URL && !!API_KEY,

  async findOne(collection: string, filter: Record<string, unknown> = {}) {
    return dataApiCall('findOne', { collection, filter })
  },

  async findMany(collection: string, filter: Record<string, unknown> = {}, options: { limit?: number; sort?: Record<string, unknown> } = {}) {
    return dataApiCall('find', { collection, filter, ...options })
  },

  async insertOne(collection: string, document: Record<string, unknown>) {
    return dataApiCall('insertOne', { collection, document })
  },

  async updateOne(collection: string, filter: Record<string, unknown>, update: Record<string, unknown>, upsert = false) {
    return dataApiCall('updateOne', {
      collection,
      filter: withObjectIdFilter(filter),
      update,
      upsert,
    })
  },

  async updateMany(collection: string, filter: Record<string, unknown>, update: Record<string, unknown>) {
    return dataApiCall('updateMany', {
      collection,
      filter: withObjectIdFilter(filter),
      update,
    })
  },

  async deleteOne(collection: string, filter: Record<string, unknown>) {
    return dataApiCall('deleteOne', {
      collection,
      filter: withObjectIdFilter(filter),
    })
  },

  async deleteMany(collection: string, filter: Record<string, unknown>) {
    return dataApiCall('deleteMany', {
      collection,
      filter: withObjectIdFilter(filter),
    })
  },

  async countDocuments(collection: string, filter: Record<string, unknown> = {}) {
    // Data API doesn't have countDocuments directly, use aggregate
    return dataApiCall('aggregate', {
      collection,
      pipeline: [{ $match: filter }, { $count: 'total' }],
    })
  },

  // Test connection — used by /api/health
  async testConnection() {
    try {
      const result = await this.countDocuments('employees', {})
      const count = (result as unknown as Array<{ total: number }>)?.[0]?.total ?? 0
      return { connected: true, employeeCount: count }
    } catch (e) {
      return { connected: false, error: e instanceof Error ? e.message : String(e) }
    }
  },
}
