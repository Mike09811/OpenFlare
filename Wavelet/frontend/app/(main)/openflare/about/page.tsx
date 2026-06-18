"use client"

import Link from "next/link"
import {useQuery} from "@tanstack/react-query"
import {Info} from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import {EmptyStateWithBorder} from "@/components/layout/empty"
import {ErrorInline} from "@/components/layout/error"
import {Badge} from "@/components/ui/badge"
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card"
import {Skeleton} from "@/components/ui/skeleton"
import {AboutService, StatusService} from "@/lib/services/openflare"
import {formatDateTime} from "@/lib/utils"

const aboutQueryKey = ["openflare", "about"] as const
const publicStatusQueryKey = ["openflare", "public-status"] as const

function AboutPageSkeleton() {
  return (
    <div className="py-6 px-1 space-y-6">
      <div className="flex items-center gap-2">
        <Skeleton className="size-5 rounded-md" />
        <Skeleton className="h-8 w-48" />
      </div>
      <Card className="border-dashed shadow-none">
        <CardHeader>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
      <Card className="border-dashed shadow-none">
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    </div>
  )
}

export default function AboutPage() {
  const aboutQuery = useQuery({
    queryKey: aboutQueryKey,
    queryFn: () => AboutService.getAboutContent(),
  })

  const statusQuery = useQuery({
    queryKey: publicStatusQueryKey,
    queryFn: () => StatusService.getPublicStatus(),
  })

  const isLoading = aboutQuery.isLoading || statusQuery.isLoading

  if (isLoading) {
    return <AboutPageSkeleton />
  }

  if (aboutQuery.isError) {
    return (
      <div className="py-6 px-1">
        <ErrorInline
          message={
            aboutQuery.error instanceof Error
              ? aboutQuery.error.message
              : "关于内容加载失败"
          }
          onRetry={() => void aboutQuery.refetch()}
        />
      </div>
    )
  }

  if (statusQuery.isError) {
    return (
      <div className="py-6 px-1">
        <ErrorInline
          message={
            statusQuery.error instanceof Error
              ? statusQuery.error.message
              : "系统状态加载失败"
          }
          onRetry={() => void statusQuery.refetch()}
        />
      </div>
    )
  }

  const aboutContent = aboutQuery.data?.trim() ?? ""
  const status = statusQuery.data

  if (!status) {
    return (
      <div className="py-6 px-1">
        <EmptyStateWithBorder
          title="暂无系统信息"
          description="未能获取 OpenFlare 的公开状态信息。"
        />
      </div>
    )
  }

  return (
    <div className="py-6 px-1 space-y-6">
      <div className="flex items-center gap-2">
        <Info className="size-5 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">关于 OpenFlare</h1>
          <p className="text-sm text-muted-foreground">
            公开展示当前系统简介、版本信息与项目入口。
          </p>
        </div>
      </div>

      <Card className="border-dashed shadow-none">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">系统信息</CardTitle>
            <CardDescription>当前运行实例的公开状态与项目链接。</CardDescription>
          </div>
          <Badge variant="secondary">{status.version || "dev"}</Badge>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-dashed px-4 py-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              系统名称
            </p>
            <p className="mt-2 text-sm font-medium">
              {status.system_name || "OpenFlare"}
            </p>
          </div>
          <div className="rounded-lg border border-dashed px-4 py-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Server 启动时间
            </p>
            <p className="mt-2 text-sm font-medium">
              {formatDateTime(new Date(status.start_time * 1000))}
            </p>
          </div>
          <div className="rounded-lg border border-dashed px-4 py-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              项目仓库
            </p>
            <a
              href="https://github.com/Rain-kl/OpenFlare"
              target="_blank"
              rel="noreferrer"
              className="mt-2 block text-sm font-medium text-primary transition hover:opacity-80"
            >
              github.com/Rain-kl/OpenFlare
            </a>
          </div>
        </CardContent>
      </Card>

      {aboutContent ? (
        <Card className="border-dashed shadow-none">
          <CardHeader>
            <CardTitle className="text-base">项目介绍</CardTitle>
            <CardDescription>
              以下内容由系统设置中的「关于内容」维护。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={[
                "prose prose-sm max-w-none dark:prose-invert",
                "prose-p:text-foreground prose-p:leading-7",
                "prose-li:text-foreground",
                "prose-strong:text-foreground",
                "prose-a:text-primary",
              ].join(" ")}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{aboutContent}</ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      ) : (
        <EmptyStateWithBorder
          title="尚未配置关于内容"
          description="可在设置页的「其他设置」标签中编写 Markdown / HTML 内容，这里会自动同步展示。"
        />
      )}

      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/openflare" className="text-primary transition hover:opacity-80">
          返回总览
        </Link>
      </div>
    </div>
  )
}