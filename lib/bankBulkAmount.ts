import { Bank } from "@/types";

export type BankBulkAmountAction = "adjust" | "set";
export type BankBulkAmountType = "income" | "expense";
export type BankBulkAmountMode = "fixed" | "separate";

export interface BankBulkAmountDraft {
  action: BankBulkAmountAction;
  type: BankBulkAmountType;
  mode: BankBulkAmountMode;
  fixedValue: string;
  separateValues: Record<string, string>;
}

export function getBankBulkAmountValue(draft: BankBulkAmountDraft, bankId: string): string {
  return draft.mode === "fixed" ? draft.fixedValue : draft.separateValues[bankId] || "";
}

export function hasBankBulkAmountValue(draft: BankBulkAmountDraft, bankId: string): boolean {
  return getBankBulkAmountValue(draft, bankId).trim() !== "";
}

export function getBankBulkAmount(draft: BankBulkAmountDraft, bankId: string): number {
  const value = getBankBulkAmountValue(draft, bankId).trim();
  return value ? Number(value) : 0;
}

export function getBankBulkNextDeposit(bank: Bank, draft: BankBulkAmountDraft): number {
  const amount = getBankBulkAmount(draft, bank.$id);
  if (draft.action === "set") return amount;
  const direction = draft.type === "income" ? 1 : -1;
  return (Number(bank.deposit) || 0) + direction * amount;
}

export function validateBankBulkAmountDraft(banks: Bank[], draft: BankBulkAmountDraft): string | null {
  if (banks.length === 0) {
    return "請先選取要調整金額的銀行";
  }

  const validateValue = (value: string): boolean => {
    const trimmedValue = value.trim();
    const amount = Number(trimmedValue);
    if (!trimmedValue || !Number.isFinite(amount)) return false;
    return draft.action === "set" ? amount >= 0 : amount > 0;
  };

  if (draft.mode === "fixed") {
    return validateValue(draft.fixedValue)
      ? null
      : draft.action === "set"
        ? "請輸入正確固定存款數字"
        : "請輸入正確固定金額";
  }

  const invalidBank = banks.find((bank) => !validateValue(draft.separateValues[bank.$id] || ""));
  if (!invalidBank) return null;

  return `請輸入「${invalidBank.name}」的正確${draft.action === "set" ? "存款數字" : "金額"}`;
}
