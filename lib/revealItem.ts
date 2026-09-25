/**
 * 新增／修改後把該筆資料帶到畫面上：捲到固定頂端選單「略下方」並短暫標示。
 *
 * 頂端選單是 sticky，直接 scrollIntoView({ block: "start" }) 會讓項目被選單蓋住，
 * 所以先量出目前可見的 sticky 頂欄高度，再用 scroll-margin-top 多留一點空間。
 * 同一筆常有桌面表格與手機卡片兩份，只挑實際有佈局（可見）的那份。
 */

export const REVEAL_ATTRIBUTE = "data-reveal-id";

/** 項目頂端與頂欄之間多留的距離（px）。 */
const REVEAL_GAP_PX = 16;
const FLASH_CLASS = "reveal-flash";
const FLASH_MS = 1600;

/** 目前貼在視窗頂端的 sticky／fixed 頂欄底緣位置。 */
export function stickyHeaderBottom(): number {
  if (typeof document === "undefined") return 0;
  let bottom = 0;
  for (const header of Array.from(document.querySelectorAll<HTMLElement>("header"))) {
    if (header.getClientRects().length === 0) continue;
    const position = window.getComputedStyle(header).position;
    if (position !== "sticky" && position !== "fixed") continue;
    const rect = header.getBoundingClientRect();
    if (rect.top <= 1 && rect.bottom > bottom) bottom = rect.bottom;
  }
  return bottom;
}

function findVisibleItem(id: string): HTMLElement | null {
  const selector = `[${REVEAL_ATTRIBUTE}="${CSS.escape(id)}"]`;
  return Array.from(document.querySelectorAll<HTMLElement>(selector)).find(
    (element) => element.getClientRects().length > 0,
  ) ?? null;
}

/** 捲到指定項目並短暫標示；找不到（例如被篩選掉）就不動。回傳是否找到。 */
export function revealListItem(id: string): boolean {
  if (typeof document === "undefined") return false;
  const element = findVisibleItem(id);
  if (!element) return false;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  element.style.scrollMarginTop = `${Math.round(stickyHeaderBottom() + REVEAL_GAP_PX)}px`;
  element.scrollIntoView({ behavior: reducedMotion ? "instant" : "smooth", block: "start" });

  element.classList.remove(FLASH_CLASS);
  // 強制重新套用動畫，連續儲存同一筆也會再閃一次。
  void element.offsetWidth;
  element.classList.add(FLASH_CLASS);
  window.setTimeout(() => element.classList.remove(FLASH_CLASS), FLASH_MS);
  return true;
}
