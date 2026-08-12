"use client";

import { CheckCircle2, Clock3, ExternalLink, Github, GitCommitHorizontal, Workflow } from "lucide-react";
import { DataCard } from "@/components/ui/data-card";
import { PageTitle } from "@/components/ui/section-header";

const RUN_URL = "https://github.com/huang1988pioneer/CronBilibiliMission/actions/runs/31590409377";
const REPOSITORY_URL = "https://github.com/huang1988pioneer/CronBilibiliMission";

const RUN_STEPS = [
  "取得最新紀錄",
  "準備 Python 與相依套件",
  "執行 Bilibili 經驗任務",
  "提交當次經驗紀錄",
];

export default function BilibiliInfo() {
  return (
    <div className="space-y-4 lg:space-y-6">
      <PageTitle title="Bilibili 資訊" description="每日 Bilibili 經驗任務的 GitHub Actions 執行快照" />

      <DataCard className="border-emerald-200 bg-emerald-50/70 p-5 dark:border-emerald-900/60 dark:bg-emerald-950/25 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 gap-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
              <CheckCircle2 size={23} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">最近參考執行成功</p>
              <h2 className="mt-1 text-xl font-semibold text-foreground">Bilibili Daily Experience Tasks</h2>
              <p className="mt-2 text-sm leading-6 text-emerald-900/80 dark:text-emerald-100/80">
                第 585 次排程執行，2026-08-12 19:06 至 19:07（台北時間）完成。
              </p>
            </div>
          </div>
          <a
            href={RUN_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 dark:bg-emerald-500 dark:text-emerald-950 dark:hover:bg-emerald-400"
          >
            查看執行紀錄
            <ExternalLink size={16} />
          </a>
        </div>
      </DataCard>

      <div className="grid gap-4 md:grid-cols-3">
        <FactCard icon={Workflow} label="觸發方式" value="排程（schedule）" />
        <FactCard icon={Clock3} label="執行時間" value="約 14 秒" />
        <FactCard icon={GitCommitHorizontal} label="提交版本" value="994de63" mono />
      </div>

      <DataCard className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">本次工作流程</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">所有主要步驟均已成功完成。</p>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
            <CheckCircle2 size={16} /> 成功
          </span>
        </div>
        <ol className="mt-5 grid gap-3 sm:grid-cols-2">
          {RUN_STEPS.map((step, index) => (
            <li key={step} className="flex items-center gap-3 rounded-xl bg-muted/70 px-4 py-3 text-sm text-foreground">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">{index + 1}</span>
              {step}
            </li>
          ))}
        </ol>
      </DataCard>

      <DataCard className="p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <Github className="mt-0.5 shrink-0 text-foreground" size={21} />
          <div>
            <h2 className="text-lg font-semibold text-foreground">資料來源</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">本頁為指定 GitHub Actions 執行的固定快照，非 Bilibili 即時帳號資料。</p>
            <a href={REPOSITORY_URL} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-primary underline-offset-4 hover:underline">
              huang1988pioneer/CronBilibiliMission
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
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
          <Icon size={18} />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className={`mt-0.5 truncate text-sm font-semibold text-foreground ${mono ? "font-mono" : ""}`}>{value}</p>
        </div>
      </div>
    </DataCard>
  );
}
