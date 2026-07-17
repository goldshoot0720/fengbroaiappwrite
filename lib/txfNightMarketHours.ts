/**
 * 夜盤台指期 (TAIFEX Night Session) market hours.
 *
 * 交易時間 (Asia/Taipei, UTC+8):
 *   週一至週五  15:00 – 次日 05:00
 *
 * 簡化判斷邏輯：
 *   - 週六 00:00–05:00  → 算週五夜盤尾段 → open
 *   - 週六 05:00–24:00  → closed
 *   - 週日 00:00–24:00  → closed
 *   - 週一 00:00–05:00  → closed (無週日夜盤)
 *   - 週一至週五 15:00–23:59 → open
 *   - 週二至週五 00:00–05:00 → open (前一個工作日的夜盤延伸)
 *   - 其他時段 → closed
 */

const TXF_NIGHT_TZ = "Asia/Taipei";

/** 0=Sun,1=Mon,...,6=Sat */
const WEEKDAY_TO_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export type TxfNightMarketClock = {
  weekday: number;
  hour: number;
  minute: number;
  minutesOfDay: number;
  isOpen: boolean;
};

function parseTaipeiParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TXF_NIGHT_TZ,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  const weekdayLabel = get("weekday");
  const weekday = WEEKDAY_TO_INDEX[weekdayLabel] ?? -1;
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));

  return {
    weekday,
    hour: Number.isFinite(hour) ? hour : 0,
    minute: Number.isFinite(minute) ? minute : 0,
  };
}

/**
 * 取得夜盤台指期市場狀態。
 *
 * 夜盤開放時段 (台北時間):
 *   週一至週五 15:00 起 → 次日 05:00 止
 *   (週六 00:00–05:00 視為週五夜盤延伸，仍開放)
 *   週日 & 週一 00:00–05:00 不開放（無夜盤）
 */
export function getTxfNightMarketClock(date: Date = new Date()): TxfNightMarketClock {
  const { weekday, hour, minute } = parseTaipeiParts(date);
  const minutesOfDay = hour * 60 + minute;
  const openStart = 15 * 60; // 15:00
  const openEnd = 5 * 60;    // 05:00 次日

  let isOpen = false;

  if (weekday >= 1 && weekday <= 5) {
    // Mon–Fri: 開盤 15:00–23:59 → open
    // Mon–Fri: 00:00–05:00 是前一工作日夜盤尾段
    //   - 週一 00:00–05:00 不算（因為週日無夜盤）→ weekday===1 的早晨不開放
    if (minutesOfDay >= openStart) {
      isOpen = true; // 當天 15:00 後
    } else if (minutesOfDay < openEnd && weekday > 1) {
      isOpen = true; // 週二至週五凌晨 05:00 前（前日夜盤延伸）
    }
  } else if (weekday === 6) {
    // 週六 00:00–05:00: 週五夜盤延伸 → open
    if (minutesOfDay < openEnd) {
      isOpen = true;
    }
  }
  // weekday===0 (Sun): always closed

  return { weekday, hour, minute, minutesOfDay, isOpen };
}

export function isTxfNightMarketOpen(date: Date = new Date()) {
  return getTxfNightMarketClock(date).isOpen;
}

/** 即時輪詢間隔：每分鐘 */
export const TXF_NIGHT_LIVE_POLL_MS = 60_000;
