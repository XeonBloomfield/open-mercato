"use client"
import * as React from 'react'
import { Page, PageHeader, PageBody } from '@open-mercato/ui/backend/Page'
import Link from 'next/link'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { DatePicker, DateTimePicker, TimePicker } from '@open-mercato/ui/backend/inputs'
import { Button } from '@open-mercato/ui/primitives/button'

type MulticaTriggerResponse = {
  ok?: boolean
  issue?: {
    identifier?: string
    title?: string
  }
  response?: {
    issue?: {
      identifier?: string
      title?: string
    }
  }
  error?: string
}

export default function ExampleAdminIndex() {
  const t = useT()
  const [date, setDate] = React.useState<Date | null>(null)
  const [datetime, setDatetime] = React.useState<Date | null>(null)
  const [time, setTime] = React.useState<string | null>(null)
  const [isSendingToMultica, setIsSendingToMultica] = React.useState(false)
  const [multicaStatus, setMulticaStatus] = React.useState<{
    kind: 'idle' | 'success' | 'error'
    message: string
  }>({ kind: 'idle', message: '' })

  async function handleSendToMultica() {
    setIsSendingToMultica(true)
    setMulticaStatus({ kind: 'idle', message: '' })

    try {
      const response = await fetch('/api/example/multica-agent-ops', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          quoteNumber: 'SQ-DEMO-1002',
          title: 'Follow up stale quote SQ-DEMO-1002',
          specialist: 'sales-ops',
        }),
      })

      const payload = (await response.json().catch(() => null)) as MulticaTriggerResponse | null
      if (!response.ok) {
        const errorMessage =
          payload?.error ||
          payload?.response?.issue?.identifier ||
          `Request failed with status ${response.status}`
        throw new Error(errorMessage)
      }

      const issueIdentifier = payload?.response?.issue?.identifier || payload?.issue?.identifier
      const issueTitle = payload?.response?.issue?.title || payload?.issue?.title
      const summary = issueIdentifier
        ? `Created ${issueIdentifier}${issueTitle ? `: ${issueTitle}` : ''}`
        : 'Multica accepted the event for SQ-DEMO-1002.'

      setMulticaStatus({ kind: 'success', message: summary })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send the demo event to Multica.'
      setMulticaStatus({ kind: 'error', message })
    } finally {
      setIsSendingToMultica(false)
    }
  }

  const actions = (
    <Button
      data-testid="example-send-to-multica"
      type="button"
      onClick={() => void handleSendToMultica()}
      disabled={isSendingToMultica}
    >
      {isSendingToMultica ? 'Sending to Multica...' : 'Send to Multica'}
    </Button>
  )

  return (
    <Page>
      <PageHeader
        title={t('example.admin.page.title', 'Example Admin')}
        description={t('example.admin.page.description', 'Demo resources for the example module.')}
        actions={actions}
      />
      <PageBody>
        <div className="rounded-lg border p-4">
          <div className="mb-2 text-sm font-medium">Multica Demo Trigger</div>
          <p className="text-sm text-muted-foreground">
            Sends the golden Open Mercato event for <span className="font-medium text-foreground">SQ-DEMO-1002</span> so Multica creates a sales-ops issue against the seeded Brightside Solar quote.
          </p>
          {multicaStatus.kind !== 'idle' ? (
            <div
              className={`mt-3 rounded-md border px-3 py-2 text-sm ${
                multicaStatus.kind === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : 'border-rose-200 bg-rose-50 text-rose-900'
              }`}
            >
              {multicaStatus.message}
            </div>
          ) : null}
        </div>

        <div className="rounded-lg border p-4">
          <div className="text-sm mb-2">{t('example.admin.page.resources', 'Resources')}</div>
          <ul className="list-disc list-inside text-sm">
            <li>
              <Link className="underline" href="/backend/todos">{t('example.admin.page.todosList', 'Todos list')}</Link>
            </li>
          </ul>
        </div>

        {/* TEMP: Date picker demo — revert before commit (git checkout -- apps/mercato/src/modules/example/backend/page.tsx) */}
        <div className="mt-6 rounded-lg border p-4">
          <div className="text-sm font-medium mb-4">Date pickers (demo — do not commit)</div>
          <div className="flex flex-wrap gap-6">
            <div className="space-y-2">
              <label className="block text-sm text-muted-foreground">DatePicker</label>
              <DatePicker value={date} onChange={setDate} />
            </div>
            <div className="space-y-2">
              <label className="block text-sm text-muted-foreground">DateTimePicker</label>
              <DateTimePicker value={datetime} onChange={setDatetime} />
            </div>
            <div className="space-y-2">
              <label className="block text-sm text-muted-foreground">TimePicker</label>
              <TimePicker value={time} onChange={setTime} />
            </div>
          </div>
        </div>
      </PageBody>
    </Page>
  )
}
