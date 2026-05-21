import { Bank, BankFormData } from "@/types";

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
    ...overrides,
  };
}
