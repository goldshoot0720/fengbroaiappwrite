<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Git auto-ship

After meaningful work: auto-commit and auto-push. See `docs/agents/git-auto-ship.md` and `node scripts/auto-ship.mjs "type(scope): summary"`.

## 介面設計參考

新建網頁、改版既有介面或檢視 UI 設計時，自動讀取本機的 Hallmark 技能（`~/.agents/skills/hallmark/SKILL.md`），作為設計與驗收參考。依任務範圍及專案既有設計系統，檢查視覺層級、主要操作、桌面與手機排版，以及觸控和鍵盤操作。[Hallmark 來源](https://github.com/Nutlope/hallmark)

## 工程技能參考

規劃需求、撰寫規格、實作、除錯、測試、重構或審查變更時，依任務自動選讀 `~/.agents/skills/<技能名稱>/SKILL.md`。例如追查故障用 `diagnosing-bugs`，審查變更用 `code-review`。需要確認適用情境或本機缺少技能時，查閱 [AI Hero 技能目錄](https://www.aihero.dev/skills)。
