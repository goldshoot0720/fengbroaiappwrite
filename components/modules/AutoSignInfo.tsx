"use client";

import { CheckCircle2, Clock3, ExternalLink, Github, GitCommitHorizontal, Workflow, XCircle } from "lucide-react";
import { DataCard } from "@/components/ui/data-card";
import { PageTitle } from "@/components/ui/section-header";

export type AutoSignProject = {
  name: string;
  repositoryUrl: string;
  runUrl: string;
  workflowName: string;
  runNumber: number;
  startedAt: string;
  completedAt: string;
  commit: string;
  status: "success" | "failure";
};

export default function AutoSignInfo({ project }: { project: AutoSignProject }) {
  const successful = project.status === "success";
  const StatusIcon = successful ? CheckCircle2 : XCircle;
  const statusLabel = successful ? "成功" : "失敗";
  const statusClasses = successful
    ? "border-emerald-200 bg-emerald-50/70 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/25 dark:text-emerald-100"
    : "border-rose-200 bg-rose-50/70 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/25 dark:text-rose-100";
  const actionClasses = successful
    ? "bg-emerald-700 hover:bg-emerald-800 focus-visible:ring-emerald-600 dark:bg-emerald-500 dark:text-emerald-950 dark:hover:bg-emerald-400"
    : "bg-rose-700 hover:bg-rose-800 focus-visible:ring-rose-600 dark:bg-rose-500 dark:text-rose-950 dark:hover:bg-rose-400";

  return (
    <div className="space-y-4 lg:space-y-6">
      <PageTitle title={`${project.name} 資訊`} description="指定 GitHub Actions 執行紀錄的固定資訊快照" />

      <DataCard className={`p-5 sm:p-6 ${statusClasses}`}>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 gap-4">
            <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl text-white ${successful ? "bg-emerald-600" : "bg-rose-600"}`}>
              <StatusIcon size={23} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">指定參考執行：{statusLabel}</p>
              <h2 className="mt-1 text-xl font-semibold text-foreground">{project.workflowName}</h2>
              <p className="mt-2 text-sm leading-6">第 {project.runNumber} 次執行，{project.startedAt} 至 {project.completedAt}（台北時間）。</p>
            </div>
          </div>
          <a href={project.runUrl} target="_blank" rel="noreferrer" className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${actionClasses}`}>
            查看執行紀錄
            <ExternalLink size={16} />
          </a>
        </div>
      </DataCard>

      <div className="grid gap-4 md:grid-cols-3">
        <FactCard icon={Workflow} label="工作流程" value={project.workflowName} />
        <FactCard icon={Clock3} label="執行時間" value={`${project.startedAt} 起`} />
        <FactCard icon={GitCommitHorizontal} label="提交版本" value={project.commit} mono />
      </div>

      <DataCard className="p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <Github className="mt-0.5 shrink-0 text-foreground" size={21} />
          <div>
            <h2 className="text-lg font-semibold text-foreground">資料來源</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">本頁是指定執行紀錄的固定快照，非即時帳號或獎勵資料。</p>
            <a href={project.repositoryUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-primary underline-offset-4 hover:underline">
              {project.repositoryUrl.replace("https://github.com/", "")}
              <ExternalLink size={15} />
            </a>
          </div>
        </div>
      </DataCard>
    </div>
  );
}

function FactCard({ icon: Icon, label, value, mono = false }: { icon: typeof Workflow; label: string; value: string; mono?: boolean }) {
  return (
    <DataCard className="p-4">
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground"><Icon size={18} /></span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className={`mt-0.5 truncate text-sm font-semibold text-foreground ${mono ? "font-mono" : ""}`}>{value}</p>
        </div>
      </div>
    </DataCard>
  );
}
