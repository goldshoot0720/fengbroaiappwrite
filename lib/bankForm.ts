import type { Bank, BankFormData } from "@/types";

/** Appwrite 存的是 ISO datetime，<input type="date"> 只吃 YYYY-MM-DD。 */
export function toDateInputValue(value?: string): string {
  if (!value) return "";
  return value.slice(0, 10);
}

export const INITIAL_BANK_FORM: BankFormData = {
  name: "",
  deposit: 0,
  site: "",
  address: "",
  withdrawals: 0,
  transfer: 0,
  activity: "",
  card: "",
  account: "",
  note: "",
  category: "",
  expiry: "",
};

export function bankToFormData(bank: Bank, overrides: Partial<BankFormData> = {}): BankFormData {
  return {
    name: bank.name || "",
    deposit: bank.deposit || 0,
    site: bank.site || "",
    address: bank.address || "",
    withdrawals: bank.withdrawals || 0,
    transfer: bank.transfer || 0,
    activity: bank.activity || "",
    card: bank.card || "",
    account: bank.account || "",
    note: bank.note || "",
    category: bank.category || "",
    expiry: toDateInputValue(bank.expiry),
    ...overrides,
  };
}
