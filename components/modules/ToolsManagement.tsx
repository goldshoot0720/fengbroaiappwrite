"use client";

import { useState } from "react";
import { Wrench } from "lucide-react";
import { PageTitle } from "@/components/ui/section-header";
import { DataCard } from "@/components/ui/data-card";
import { Button } from "@/components/ui/button";

type ToolsTab = "price-compare";

const TOOL_TABS: { id: ToolsTab; label: string }[] = [
  { id: "price-compare", label: "鋒兄比價" },
];

export default function ToolsManagement() {
  const [activeTab, setActiveTab] = useState<ToolsTab>("price-compare");

  return (
    <section className="space-y-6">
      <PageTitle title="鋒兄工具" description="工具模組集中入口與建置狀態" />

      <DataCard className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          {TOOL_TABS.map((tab) => (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </Button>
          ))}
        </div>
      </DataCard>

      <DataCard className="p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
            <Wrench size={20} />
          </div>
          <div>
            <h3 className="text-lg font-semibold">鋒兄比價</h3>
            <p className="text-sm text-muted-foreground">工具建置中</p>
          </div>
        </div>
      </DataCard>
    </section>
  );
}
