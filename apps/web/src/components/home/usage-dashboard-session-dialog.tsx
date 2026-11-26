"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import type { AgentUsageRecord, AgentUsageSessionDetail } from "@flow-spaces/shared"
import { Loader2, Trash2 } from "lucide-react"

import { AgentSessionMessagesView } from "@/components/chat/agent-session-messages-view"
import { ContextPartChatView } from "@/components/chat/message-context-to-chat"
import { Chip } from "@/components/base/badges/chip"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabList, Tab, TabPanel } from "@/components/base/tabs/tabs"
import { JsonViewer } from "@/components/viewers/json-viewer"
import { sdk } from "@/lib/sdk"

import { formatCurrency, formatDuration, formatTokens } from "./usage-dashboard-utils"

export function UsageDashboardSessionDialog({
  record,
  open,
  onOpenChange,
  detailOverride,
}: {
  record: AgentUsageRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
  detailOverride?: AgentUsageSessionDetail | null
}) {
  const t = useTranslations("home")
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState<AgentUsageSessionDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState("messages")

  useEffect(() => {
    if (!open || !record) return
    if (detailOverride) {
      setLoading(false)
      setError(null)
      setDetail(detailOverride)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    setDetail(null)
    sdk.agent.sessionDetail(record.agentSessionId)
      .then((data) => {
        if (cancelled) return
        setDetail(data)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, record, detailOverride])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85vh] flex-col !w-[min(1120px,calc(100vw-2rem))] !max-w-[min(1120px,calc(100vw-2rem))] gap-3 overflow-hidden p-0">
        <Tabs selectedKey={tab} onSelectionChange={(k) => setTab(String(k))} className="min-h-0 flex-1 overflow-hidden">
          <DialogHeader className="border-b px-4 pt-4 pb-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-col gap-1 min-w-0">
                <DialogTitle className="flex flex-wrap items-center gap-2">
                  <span>{ t("sessionDetail.title")}</span>
                  {record?.runtime ? <Chip variant="caption" color="gray">{record.runtime}</Chip> : null}
                  {record?.model ? <Chip variant="caption" color="gray">{record.model}</Chip> : null}
                  {record?.status ? <Chip variant="caption" color="neutral">{record.status}</Chip> : null}
                </DialogTitle>
                <DialogDescription className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <span>{t("sessionDetail.requests")}: {formatTokens(record?.totalTokens ?? 0)}</span>
                  <span>{t("sessionDetail.cost")}: {formatCurrency(record?.totalCostUsd ?? 0)}</span>
                  <span>{t("sessionDetail.duration")}: {formatDuration(record?.durationMs ?? 0)}</span>
                  {record?.agentSessionId ? <span className="font-mono">{record.agentSessionId}</span> : null}
                </DialogDescription>
              </div>
              <TabList className="shrink-0 me-5">
                <Tab id="messages">
                  {t("sessionDetail.messages")}
                </Tab>
                <Tab id="raw">
                  {t("sessionDetail.raw")}
                </Tab>
              </TabList>
            </div>
          </DialogHeader>

          <TabPanel id="messages" className="flex min-h-0 flex-1 flex-col px-4 pb-4">
            <ScrollArea className="flex-1 min-h-0" viewportClassName="pr-3">
              {detail?.systemPrompt ? (
                <div className="mb-3 rounded-md border bg-muted/30 p-3">
                  <div className="mb-2 text-[11px] font-medium text-muted-foreground">
                    {t("sessionDetail.systemPrompt")}
                  </div>
                  <pre className="max-h-36 overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-foreground">
                    {detail.systemPrompt}
                  </pre>
                </div>
              ) : null}
              {detail?.fullPrompt ? (
                <div className="mb-3 rounded-md border bg-muted/30 p-3">
                  <div className="mb-2 text-[11px] font-medium text-muted-foreground">
                    Full Prompt
                  </div>
                  <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-foreground">
                    {detail.fullPrompt}
                  </pre>
                </div>
              ) : null}
              {loading ? (
                <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  {t("sessionDetail.loading")}
                </div>
              ) : error ? (
                <div className="flex h-40 items-center justify-center text-sm text-destructive">
                  {error}
                </div>
              ) : !detail?.messages?.length ? (
                <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                  {t("sessionDetail.empty")}
                </div>
              ) : (
                <AgentSessionMessagesView
                  className="flex flex-col gap-3 py-3"
                  messages={detail.messages}
                  renderContextPart={(part) => <ContextPartChatView part={part} />}
                />
              )}
            </ScrollArea>
          </TabPanel>

          <TabPanel id="raw" className="flex min-h-0 flex-1 flex-col px-4 pb-4">
            <ScrollArea className="flex-1 min-h-0" viewportClassName="pr-3">
              <div className="space-y-3 py-3">
                {detail?.cliHistoryPath ? (
                  <div className="rounded-md border bg-muted/30 px-3 py-2 font-mono text-xs text-muted-foreground">
                    {detail.cliHistoryPath}
                  </div>
                ) : null}
                <JsonViewer
                  data={((detail?.rawSession ?? detail) || null) as never}
                  title={t("sessionDetail.raw")}
                  defaultExpanded={1}
                  rootName="session"
                />
              </div>
            </ScrollArea>
          </TabPanel>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

export function SessionDetailButton({ onView, onDelete }: { onView: () => void; onDelete: () => void }) {
  const t = useTranslations("home")

  return (
    <div className="flex items-center gap-1">
      <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onView}>
        {t("sessionDetail.view")}
      </Button>
      <AlertDialog>
        <AlertDialogTrigger
          render={
            <Button type="button" variant="ghost" size="icon-sm" className="size-7 text-muted-foreground hover:text-destructive" aria-label={t("sessionDetail.delete")}>
              <Trash2 className="size-3.5" />
            </Button>
          }
        />
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("sessionDetail.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("sessionDetail.deleteConfirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("sessionDetail.cancel")}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={onDelete}>
              {t("sessionDetail.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}