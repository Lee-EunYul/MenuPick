import { app, HttpRequest, HttpResponseInit } from '@azure/functions'

app.http('health', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'v1/health',
  handler: async (_request: HttpRequest): Promise<HttpResponseInit> => {
    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }),
    }
  },
})
