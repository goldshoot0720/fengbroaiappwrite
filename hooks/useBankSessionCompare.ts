"use client";

import { useEffect, useState } from "react";
import { Bank } from "@/types";

/**
 * 關於頁「銀行最高存款／銀行最低存款」指的是「總存款」的極值，並與
 * 「上次使用網站」的紀錄比對。做法：每次載入銀行資料時把總存款快照
 * 記到 localStorage，累積出歷史最高／最低總存款；同時保留上一次的
 * 總存款，供顯示「比上次多／少」。
 */

const SNAPSHOT_STORAGE_KEY = "fengbro:bank-deposit-snapshot";

interface StoredSnapshot {
  /** 歷史最高總存款 */
  maxTotal: number;
  /** 歷史最低總存款（第一次看到有資料的那次） */
  minTotal: number;
  /** 上一次使用網站時的總存款 */
  lastTotal: number;
  lastCapturedAt: string;
}

export interface BankSessionCompare {
  /** 目前總存款（所有銀行帳戶 deposit 加總） */
  currentTotal: number;
  /** 歷史最高總存款 */
  maxTotal: number;
  /** 歷史最低總存款 */
  minTotal: number;
  /** 上次使用網站時的總存款（沒有紀錄為 null） */
  lastTotal: number | null;
  /** 目前最高單一帳戶（供附註顯示） */
  highestAccount: { name: string; deposit: number } | null;
  /** 目前最低單一帳戶（只看有餘額；供附註顯示） */
  lowestAccount: { name: string; deposit: number } | null;
  /** 與上次總存款的差額 */
  delta: number | null;
  /** 上次快照時間 */
  lastCapturedAt: string | null;
}

export function useBankSessionCompare(banks: Bank[]): BankSessionCompare {
  // baseline 是「上次使用網站」留下的快照，掛載時讀一次後不再更動，
  // 這樣本次的比對與 Delta 不會因為寫入新快照而變成跟自己比。
  const [baseline, setBaseline] = useState<StoredSnapshot | null>(null);
  const [snapshotReady, setSnapshotReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SNAPSHOT_STORAGE_KEY);
      if (raw) setBaseline(JSON.parse(raw) as StoredSnapshot);
    } catch {
      // 快照格式錯誤或 localStorage 不可用時忽略。
    }
    setSnapshotReady(true);
  }, []);

  const sorted = [...banks].sort((a, b) => (b.deposit || 0) - (a.deposit || 0));
  const currentTotal = sorted.reduce((total, bank) => total + (bank.deposit || 0), 0);

  const withBalance = sorted.filter((bank) => (bank.deposit || 0) > 0);
  const highestBank = sorted[0] && (sorted[0].deposit || 0) > 0 ? sorted[0] : null;
  const lowestBank = withBalance.length > 0 ? withBalance[withBalance.length - 1] : null;

  const highestAccount = highestBank
    ? { name: highestBank.name, deposit: highestBank.deposit || 0 }
    : null;
  const lowestAccount = lowestBank
    ? { name: lowestBank.name, deposit: lowestBank.deposit || 0 }
    : null;

  // 資料載入完成後，寫入「這次」快照供下次比對。
  useEffect(() => {
    if (!snapshotReady || banks.length === 0) return;
    const next: StoredSnapshot = {
      maxTotal: baseline == null ? currentTotal : Math.max(baseline.maxTotal, currentTotal),
      minTotal: baseline == null ? currentTotal : Math.min(baseline.minTotal, currentTotal),
      lastTotal: currentTotal,
      lastCapturedAt: new Date().toISOString(),
    };
    try {
      window.localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // localStorage 不可用時略過。
    }
  }, [snapshotReady, currentTotal, banks.length, baseline]);

  const prev = snapshotReady ? baseline : null;

  return {
    currentTotal,
    maxTotal: prev ? Math.max(prev.maxTotal, currentTotal) : currentTotal,
    minTotal: prev ? Math.min(prev.minTotal, currentTotal) : currentTotal,
    lastTotal: prev?.lastTotal ?? null,
    highestAccount,
    lowestAccount,
    delta: prev ? currentTotal - prev.lastTotal : null,
    lastCapturedAt: prev?.lastCapturedAt ?? null,
  };
}
