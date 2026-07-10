'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

interface BankAccount {
  id: string;
  name: string;
  balance: number;
  accountNumber: string;
}

interface ETicket {
  id: string;
  name: string;
  balance: number;
  cardNumber: string;
}

export default function BankPage() {
  // 銀行帳戶資料
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([
    { id: '1', name: '鋒兄主帳戶', balance: 150000, accountNumber: '1234-5678-9012' },
    { id: '2', name: '儲蓄帳戶', balance: 300000, accountNumber: '9876-5432-1098' },
  ]);

  // 電子票證資料
  const [eTickets, setETickets] = useState<ETicket[]>([
    { id: '1', name: '悠遊卡', balance: 850, cardNumber: '**** **** 1234' },
    { id: '2', name: '一卡通', balance: 620, cardNumber: '**** **** 5678' },
    { id: '3', name: '愛金卡', balance: 450, cardNumber: '**** **** 9012' },
  ]);

  // 表單狀態
  const [bankForm, setBankForm] = useState({ name: '', balance: '', accountNumber: '' });
  const [eTicketForm, setETicketForm] = useState({ name: '', balance: '', cardNumber: '' });

  // 新增銀行帳戶
  const handleAddBank = (e: React.FormEvent) => {
    e.preventDefault();
    if (bankForm.name && bankForm.balance && bankForm.accountNumber) {
      const newBank: BankAccount = {
        id: Date.now().toString(),
        name: bankForm.name,
        balance: parseFloat(bankForm.balance),
        accountNumber: bankForm.accountNumber,
      };
      setBankAccounts([...bankAccounts, newBank]);
      setBankForm({ name: '', balance: '', accountNumber: '' });
    }
  };

  // 新增電子票證
  const handleAddETicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (eTicketForm.name && eTicketForm.balance && eTicketForm.cardNumber) {
      const newTicket: ETicket = {
        id: Date.now().toString(),
        name: eTicketForm.name,
        balance: parseFloat(eTicketForm.balance),
        cardNumber: eTicketForm.cardNumber,
      };
      setETickets([...eTickets, newTicket]);
      setETicketForm({ name: '', balance: '', cardNumber: '' });
    }
  };

  // 刪除銀行帳戶
  const handleDeleteBank = (id: string) => {
    setBankAccounts(bankAccounts.filter(account => account.id !== id));
  };

  // 刪除電子票證
  const handleDeleteETicket = (id: string) => {
    setETickets(eTickets.filter(ticket => ticket.id !== id));
  };

  // 格式化金額
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('zh-TW', {
      style: 'currency',
      currency: 'TWD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // 計算總資產
  const totalBankBalance = bankAccounts.reduce((sum, account) => sum + account.balance, 0);
  const totalETicketBalance = eTickets.reduce((sum, ticket) => sum + ticket.balance, 0);
  const totalAssets = totalBankBalance + totalETicketBalance;

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">鋒兄銀行</h1>
        <p className="text-muted-foreground">管理你的銀行帳戶與電子票證</p>
      </div>

      {/* 總資產概覽 */}
      <Card className="mb-8 bg-gradient-to-br from-blue-500 to-purple-600 text-white">
        <CardHeader>
          <CardTitle className="text-white">總資產</CardTitle>
          <CardDescription className="text-blue-100">所有帳戶與票證總和</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold">{formatCurrency(totalAssets)}</div>
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-blue-100">銀行帳戶</div>
              <div className="text-xl font-semibold">{formatCurrency(totalBankBalance)}</div>
            </div>
            <div>
              <div className="text-blue-100">電子票證</div>
              <div className="text-xl font-semibold">{formatCurrency(totalETicketBalance)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 銀行區塊 */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-bold">🏦 銀行帳戶</h2>
        </div>

        {/* 銀行帳戶列表 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {bankAccounts.map((account) => (
            <Card key={account.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {account.name}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteBank(account.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    刪除
                  </Button>
                </CardTitle>
                <CardDescription>{account.accountNumber}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(account.balance)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 新增銀行帳戶表單 */}
        <Card>
          <CardHeader>
            <CardTitle>新增銀行帳戶</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddBank} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="bank-name">帳戶名稱</Label>
                  <Input
                    id="bank-name"
                    placeholder="例如：主帳戶"
                    value={bankForm.name}
                    onChange={(e) => setBankForm({ ...bankForm, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="bank-balance">餘額</Label>
                  <Input
                    id="bank-balance"
                    type="number"
                    placeholder="0"
                    value={bankForm.balance}
                    onChange={(e) => setBankForm({ ...bankForm, balance: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="bank-account">帳號</Label>
                  <Input
                    id="bank-account"
                    placeholder="1234-5678-9012"
                    value={bankForm.accountNumber}
                    onChange={(e) => setBankForm({ ...bankForm, accountNumber: e.target.value })}
                    required
                  />
                </div>
              </div>
              <Button type="submit" className="w-full">新增帳戶</Button>
            </form>
          </CardContent>
        </Card>
      </section>

      <Separator className="my-12" />

      {/* 電子票證區塊 */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-bold">💳 電子票證</h2>
        </div>

        {/* 電子票證列表 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {eTickets.map((ticket) => (
            <Card key={ticket.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {ticket.name}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteETicket(ticket.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    刪除
                  </Button>
                </CardTitle>
                <CardDescription>{ticket.cardNumber}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {formatCurrency(ticket.balance)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 新增電子票證表單 */}
        <Card>
          <CardHeader>
            <CardTitle>新增電子票證</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddETicket} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="ticket-name">票證名稱</Label>
                  <Input
                    id="ticket-name"
                    placeholder="例如：悠遊卡"
                    value={eTicketForm.name}
                    onChange={(e) => setETicketForm({ ...eTicketForm, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="ticket-balance">餘額</Label>
                  <Input
                    id="ticket-balance"
                    type="number"
                    placeholder="0"
                    value={eTicketForm.balance}
                    onChange={(e) => setETicketForm({ ...eTicketForm, balance: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="ticket-card">卡號</Label>
                  <Input
                    id="ticket-card"
                    placeholder="**** **** 1234"
                    value={eTicketForm.cardNumber}
                    onChange={(e) => setETicketForm({ ...eTicketForm, cardNumber: e.target.value })}
                    required
                  />
                </div>
              </div>
              <Button type="submit" className="w-full">新增票證</Button>
            </form>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
