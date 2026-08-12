import ServiceInfo from "@/components/modules/ServiceInfo";

export default function DigenInfo() {
  return <ServiceInfo project={{ name: "Digen", description: "Digen 每日點數獎勵與帳戶使用說明", repositoryUrl: "https://github.com/huang1988pioneer/AutoSignDigen", runUrl: "https://github.com/huang1988pioneer/AutoSignDigen/actions/runs/31606230251", workflowName: "Digen Daily Reward", runNumber: 191, completedAt: "2026-08-12 22:25（台北時間）", status: "success", overview: "目前鋒兄可公開驗證的 Digen 整合範圍是帳戶每日登入點數獎勵：自動化專案會呼叫登入獎勵流程並記錄結果。服務內其他可用功能應以你登入後的 Digen 介面與官方條款為準。", capabilities: ["領取每日登入點數獎勵，作為帳戶可用額度的一部分。", "透過帳戶頁確認點數餘額、使用紀錄與當前可用服務。", "使用鋒兄工作流查看簽到是否完成及連續天數摘要。", "在功能不明或頁面調整時，以服務官方介面為準，避免依舊資料操作。"], steps: ["先登入 Digen，確認帳戶已能看到點數或每日獎勵入口。", "查看每日獎勵後的點數變化，將服務頁面顯示作為最終結果。", "若使用鋒兄自動化，僅把工作流狀態當作執行佐證；必要時手動重新確認。", "服務需要使用點數前，先確認用途、扣點規則與帳戶權限。"], automationScope: "工作流在台北時間 05:05、13:05、21:05 的排程窗口執行每日登入獎勵請求，並輸出摘要與連續天數資訊。", caution: "此頁不推定 Digen 的其他產品功能或點數價值。Token 只能存於 GitHub Secrets，且登入獎勵規則若有變更，以 Digen 帳戶頁為準。" }} />;
}
