"use client";

import { CheckCircle2, CircleAlert, ExternalLink, Github, ListChecks, ShieldCheck, Sparkles, Workflow } from "lucide-react";
import { DataCard } from "@/components/ui/data-card";
import { PageTitle } from "@/components/ui/section-header";

export type ServiceInfoProject = {
  name: string;
  description: string;
  serviceUrl?: string;
  serviceLabel?: string;
  repositoryUrl: string;
  runUrl: string;
  workflowName: string;
  runNumber: number;
  completedAt: string;
  status: "success" | "failure";
  overview: string;
  capabilities: string[];
  steps: string[];
  automationScope: string;
  caution: string;
};

export default function ServiceInfo({ project }: { project: ServiceInfoProject }) {
  const successful = project.status === "success";

  return (
    <div className="mx-auto max-w-5xl space-y-5 lg:space-y-7">
      <PageTitle title={`${project.name} 資訊`} description={project.description} />

      <DataCard className="p-5 sm:p-7">
        <div className="flex items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
            <Sparkles size={22} aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">服務定位</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">{project.overview}</p>
            {project.serviceUrl && (
              <a href={project.serviceUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {project.serviceLabel || `開啟 ${project.name}`} <ExternalLink size={16} aria-hidden />
              </a>
            )}
          </div>
        </div>
      </DataCard>

      <section aria-labelledby="capabilities-heading">
        <div className="mb-3 flex items-center gap-2">
          <ListChecks className="text-amber-700 dark:text-amber-300" size={20} aria-hidden />
          <h2 id="capabilities-heading" className="text-lg font-semibold text-foreground">可做什麼</h2>
        </div>
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {project.capabilities.map((capability) => (
            <li key={capability} className="flex gap-3 px-4 py-3.5 text-sm leading-6 text-foreground sm:px-5">
              <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" size={18} aria-hidden />
              <span>{capability}</span>
            </li>
          ))}
        </ul>
      </section>

      <DataCard className="p-5 sm:p-7">
        <div className="flex items-center gap-2">
          <Workflow className="text-amber-700 dark:text-amber-300" size={20} aria-hidden />
          <h2 className="text-lg font-semibold text-foreground">建議使用流程</h2>
        </div>
        <ol className="mt-4 space-y-4">
          {project.steps.map((step, index) => (
            <li key={step} className="flex gap-3 text-sm leading-6 text-muted-foreground">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background">{index + 1}</span>
              <span className="pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
      </DataCard>

      <section aria-labelledby="automation-heading">
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck className="text-amber-700 dark:text-amber-300" size={20} aria-hidden />
          <h2 id="automation-heading" className="text-lg font-semibold text-foreground">鋒兄自動化結果</h2>
        </div>
        <DataCard className="p-5 sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className={`inline-flex items-center gap-2 text-sm font-semibold ${successful ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}`}>
                {successful ? <CheckCircle2 size={18} aria-hidden /> : <CircleAlert size={18} aria-hidden />}
                {successful ? "最近一次工作流完成" : "最近一次工作流失敗"}
              </p>
              <p className="mt-2 text-base font-semibold text-foreground">{project.workflowName} · 第 {project.runNumber} 次</p>
              <p className="mt-1 text-sm text-muted-foreground">完成時間：{project.completedAt}</p>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-muted-foreground">{project.automationScope}</p>
            </div>
            <a href={project.runUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-foreground px-4 text-sm font-semibold text-background transition-colors hover:bg-foreground/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              查看執行紀錄 <ExternalLink size={16} aria-hidden />
            </a>
          </div>
          <div className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
            <span className="font-semibold">使用提醒：</span>{project.caution}
          </div>
        </DataCard>
      </section>

      <a href={project.repositoryUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Github size={18} aria-hidden /> 查看鋒兄自動化專案說明 <ExternalLink size={15} aria-hidden />
      </a>
    </div>
  );
}
