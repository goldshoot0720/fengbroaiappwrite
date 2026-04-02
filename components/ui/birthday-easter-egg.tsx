"use client";

import { useEffect, useMemo, useState } from "react";
import { Gift, Sparkles, X } from "lucide-react";

type BirthdayEasterEggContent = {
  badge: string;
  title: string;
  message: string;
};

function getBirthdayEasterEggContent(): BirthdayEasterEggContent | null {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(new Date());
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (month === "04" && day === "03") {
    return {
      badge: "April 3 Surprise",
      title: "塗哥生日快樂",
      message: "今彩539頭獎得主鋒兄，今天整站啟動生日彩蛋模式。",
    };
  }

  if (month === "11" && day === "27") {
    return {
      badge: "November 27 Surprise",
      title: "鋒兄生日快樂",
      message: "高考三級資訊處理榜首鋒兄，今天全站啟動專屬生日特效。",
    };
  }

  return null;
}

export function BirthdayEasterEgg() {
  const [content, setContent] = useState<BirthdayEasterEggContent | null>(null);

  useEffect(() => {
    setContent(getBirthdayEasterEggContent());
  }, []);

  const confettiPieces = useMemo(
    () =>
      Array.from({ length: 18 }, (_, index) => ({
        id: index,
        left: `${4 + (index % 9) * 11}%`,
        delay: `${(index % 6) * 0.35}s`,
        duration: `${5.2 + (index % 5) * 0.45}s`,
        color:
          index % 3 === 0
            ? "bg-amber-400"
            : index % 3 === 1
              ? "bg-rose-400"
              : "bg-sky-400",
      })),
    []
  );

  if (!content) return null;

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[80] overflow-hidden">
        {confettiPieces.map((piece) => (
          <span
            key={piece.id}
            className={`absolute top-0 h-3 w-2 rounded-full opacity-80 ${piece.color}`}
            style={{
              left: piece.left,
              animation: `birthday-confetti ${piece.duration} linear infinite`,
              animationDelay: piece.delay,
            }}
          />
        ))}
      </div>

      <div className="pointer-events-none fixed inset-x-3 top-3 z-[81] flex justify-center sm:inset-x-6 sm:top-4">
        <div className="pointer-events-auto w-full max-w-3xl rounded-[28px] border border-amber-200/80 bg-[linear-gradient(135deg,rgba(255,247,214,0.96),rgba(255,232,178,0.94))] p-4 text-slate-900 shadow-[0_24px_60px_rgba(176,120,14,0.22)] backdrop-blur-xl dark:border-amber-300/20 dark:bg-[linear-gradient(135deg,rgba(86,55,6,0.92),rgba(38,24,3,0.92))] dark:text-amber-50">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/70 text-amber-600 shadow-inner dark:bg-white/10 dark:text-amber-300">
              <Gift size={24} />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-700/80 dark:text-amber-200/80">
                <Sparkles size={14} />
                {content.badge}
              </div>
              <p className="mt-1 text-lg font-bold sm:text-2xl">{content.title}</p>
              <p className="mt-1 text-sm leading-6 text-slate-700 dark:text-amber-100/88 sm:text-base">
                {content.message}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setContent(null)}
              className="rounded-full border border-white/60 bg-white/60 p-2 text-slate-700 transition hover:bg-white dark:border-white/10 dark:bg-white/10 dark:text-amber-50 dark:hover:bg-white/20"
              aria-label="關閉生日彩蛋"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
