import { createHmac } from 'node:crypto'
import { z } from 'zod'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { exampleTag } from '../openapi'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['example.view'] },
}

const requestSchema = z.object({
  eventId: z.string().trim().optional(),
  eventType: z.string().trim().default('sales.quote.inactive'),
  title: z.string().trim().default('Follow up stale quote SQ-DEMO-1002'),
  description: z.string().trim().default('Quote has had no customer-facing activity for 7 days. Review owner, quote history, and next safe follow-up action.'),
  specialist: z.enum(['sales-ops', 'customer-success', 'finance-ops']).default('sales-ops'),
  priority: z.enum(['urgent', 'high', 'medium', 'low', 'none']).default('high'),
  quoteNumber: z.string().trim().default('SQ-DEMO-1002'),
  sourceUrl: z.string().trim().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

function parseWebhookSecret(secret: string): Buffer | string {
  const trimmed = secret.trim()
  if (trimmed.startsWith('whsec_')) {
    try {
      const decoded = Buffer.from(trimmed.slice('whsec_'.length), 'base64')
      if (decoded.length > 0) return decoded
    } catch {
      // Fall through to raw secret for malformed demo values.
    }
  }
  return trimmed
}

function buildSignature(secret: string, timestamp: string, body: string): string {
  return createHmac('sha256', parseWebhookSecret(secret))
    .update(`${timestamp}.${body}`)
    .digest('hex')
}

export async function POST(request: Request) {
  const auth = await getAuthFromRequest(request)
  if (!auth?.tenantId || !auth.orgId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const webhookUrl = process.env.MULTICA_OPEN_MERCATO_WEBHOOK_URL?.trim()
  const webhookSecret = process.env.MULTICA_OPEN_MERCATO_WEBHOOK_SECRET?.trim()
  if (!webhookUrl || !webhookSecret) {
    return Response.json({
      error: 'Set MULTICA_OPEN_MERCATO_WEBHOOK_URL and MULTICA_OPEN_MERCATO_WEBHOOK_SECRET first.',
    }, { status: 503 })
  }

  const rawBody = await request.text()
  let parsedInput: unknown = {}
  if (rawBody) {
    try {
      parsedInput = JSON.parse(rawBody)
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
  }
  const parsed = requestSchema.parse(parsedInput)
  const payload = {
    event_id: parsed.eventId ?? `om-${Date.now()}`,
    event_type: parsed.eventType,
    title: parsed.title,
    description: parsed.description,
    specialist: parsed.specialist,
    priority: parsed.priority,
    source_url: parsed.sourceUrl || `${new URL(request.url).origin}/backend/sales/quotes`,
    metadata: {
      quoteNumber: parsed.quoteNumber,
      tenantId: auth.tenantId,
      organizationId: auth.orgId,
      triggeredByUserId: auth.sub,
      ...parsed.metadata,
    },
  }

  const body = JSON.stringify(payload)
  const timestamp = String(Math.floor(Date.now() / 1000))
  const signature = buildSignature(webhookSecret, timestamp, body)

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-open-mercato-timestamp': timestamp,
      'x-open-mercato-signature': `sha256=${signature}`,
    },
    body,
  })

  const responseBody = await response.json().catch(() => null)
  return Response.json({
    ok: response.ok,
    target: webhookUrl,
    payload,
    response: responseBody,
  }, { status: response.status })
}

export const openApi: OpenApiRouteDoc = {
  tag: exampleTag,
  methods: {
    POST: {
      summary: 'Send a signed Open Mercato demo event to Multica',
      tags: [exampleTag],
      responses: [
        {
          status: 200,
          description: 'Event forwarded successfully',
        },
        {
          status: 503,
          description: 'Multica webhook env vars are missing',
        },
      ],
    },
  },
}
