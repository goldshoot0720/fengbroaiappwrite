"use client";

import { useCallback, useEffect, useState } from "react";
import { revealListItem } from "@/lib/revealItem";

/**
 * 回傳 reveal(id)：等 React 重新渲染、瀏覽器完成新佈局（排序、表單收起）後，
 * 把該筆捲到頂端選單略下方並短暫標示。項目需帶 data-reveal-id。
 */
export function useRevealItem() {
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    if (!target) return;
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        revealListItem(target);
        setTarget(null);
      });
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
  }, [target]);

  return useCallback((id: string | null | undefined) => {
    if (id) setTarget(id);
  }, []);
}
