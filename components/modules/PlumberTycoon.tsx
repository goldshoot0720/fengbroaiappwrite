'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Building2, 
  Cpu, 
  GraduationCap, 
  Heart, 
  Landmark, 
  Network, 
  Construction,
  Warehouse,
  Bot,
  Utensils,
  BookOpen,
  Building
} from 'lucide-react';

interface BusinessUnit {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
}

const BUSINESS_UNITS: BusinessUnit[] = [
  {
    id: 'engineering',
    name: '水電工程行',
    icon: <Construction className="w-6 h-6" />,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    borderColor: 'border-blue-200 dark:border-blue-800',
    description: '專業水電工程服務',
  },
  {
    id: 'ai',
    name: '水電人工智慧股份有限公司',
    icon: <Cpu className="w-6 h-6" />,
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-950/30',
    borderColor: 'border-purple-200 dark:border-purple-800',
    description: 'AI 技術研發與應用',
  },
  {
    id: 'info',
    name: '水電資訊',
    icon: <Network className="w-6 h-6" />,
    color: 'text-cyan-600 dark:text-cyan-400',
    bgColor: 'bg-cyan-50 dark:bg-cyan-950/30',
    borderColor: 'border-cyan-200 dark:border-cyan-800',
    description: '資訊系統整合服務',
  },
  {
    id: 'tech',
    name: '水電科技',
    icon: <Cpu className="w-6 h-6" />,
    color: 'text-indigo-600 dark:text-indigo-400',
    bgColor: 'bg-indigo-50 dark:bg-indigo-950/30',
    borderColor: 'border-indigo-200 dark:border-indigo-800',
    description: '科技創新與研發',
  },
  {
    id: 'construction',
    name: '水電營造',
    icon: <Building className="w-6 h-6" />,
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-950/30',
    borderColor: 'border-orange-200 dark:border-orange-800',
    description: '大型營造工程',
  },
  {
    id: 'development',
    name: '水電建設',
    icon: <Warehouse className="w-6 h-6" />,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-950/30',
    borderColor: 'border-amber-200 dark:border-amber-800',
    description: '建設開發與管理',
  },
  {
    id: 'robot',
    name: '水電機器人',
    icon: <Bot className="w-6 h-6" />,
    color: 'text-teal-600 dark:text-teal-400',
    bgColor: 'bg-teal-50 dark:bg-teal-950/30',
    borderColor: 'border-teal-200 dark:border-teal-800',
    description: '智能機器人研發',
  },
  {
    id: 'bank',
    name: '水電銀行',
    icon: <Landmark className="w-6 h-6" />,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-950/30',
    borderColor: 'border-green-200 dark:border-green-800',
    description: '金融服務與投資',
  },
  {
    id: 'restaurant',
    name: '水電餐飲',
    icon: <Utensils className="w-6 h-6" />,
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-950/30',
    borderColor: 'border-red-200 dark:border-red-800',
    description: '餐飲連鎖經營',
  },
  {
    id: 'culture',
    name: '水電文化事業',
    icon: <BookOpen className="w-6 h-6" />,
    color: 'text-pink-600 dark:text-pink-400',
    bgColor: 'bg-pink-50 dark:bg-pink-950/30',
    borderColor: 'border-pink-200 dark:border-pink-800',
    description: '文化產業發展',
  },
  {
    id: 'hospital',
    name: '水電醫院',
    icon: <Heart className="w-6 h-6" />,
    color: 'text-rose-600 dark:text-rose-400',
    bgColor: 'bg-rose-50 dark:bg-rose-950/30',
    borderColor: 'border-rose-200 dark:border-rose-800',
    description: '醫療健康服務',
  },
  {
    id: 'university',
    name: '水電大學',
    icon: <GraduationCap className="w-6 h-6" />,
    color: 'text-violet-600 dark:text-violet-400',
    bgColor: 'bg-violet-50 dark:bg-violet-950/30',
    borderColor: 'border-violet-200 dark:border-violet-800',
    description: '高等教育機構',
  },
  {
    id: 'foundation',
    name: '水電基金會',
    icon: <Building2 className="w-6 h-6" />,
    color: 'text-slate-600 dark:text-slate-400',
    bgColor: 'bg-slate-50 dark:bg-slate-950/30',
    borderColor: 'border-slate-200 dark:border-slate-800',
    description: '公益慈善基金會',
  },
];

export default function PlumberTycoon() {
  return (
    <div className="space-y-6">
      {/* 標題區 */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full">
          <Building2 className="w-8 h-8 text-white" />
          <h1 className="text-3xl font-bold text-white">水電大亨</h1>
        </div>
        <p className="text-xl text-gray-600 dark:text-gray-400">事業版圖</p>
        <p className="text-sm text-gray-500 dark:text-gray-500 max-w-2xl mx-auto">
          從傳統水電工程起家,逐步發展成為橫跨科技、金融、教育、醫療等多領域的綜合性企業集團
        </p>
      </div>

      {/* 人物照片區 */}
      <div className="flex justify-center mb-8">
        <div className="relative">
          <div className="w-64 h-64 rounded-3xl overflow-hidden border-4 border-gradient-to-r from-blue-500 to-purple-600 shadow-2xl bg-white">
            <img
              src="/plumber-tycoon.jpg"
              alt="水電大亨"
              className="w-full h-full object-cover object-center"
            />
          </div>
          <div className="absolute -bottom-3 -right-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full p-4 shadow-2xl">
            <Building2 className="w-8 h-8 text-white" />
          </div>
        </div>
      </div>

      {/* 事業單位網格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {BUSINESS_UNITS.map((unit, index) => (
          <Card
            key={unit.id}
            className={`${unit.bgColor} ${unit.borderColor} border-2 hover:shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer`}
          >
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-3">
                <div className={`${unit.color}`}>
                  {unit.icon}
                </div>
                <div className="flex-1">
                  <div className={`text-base font-bold ${unit.color}`}>
                    {unit.name}
                  </div>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {unit.description}
              </p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-500">
                  No. {String(index + 1).padStart(2, '0')}
                </span>
                <div className={`w-2 h-2 rounded-full ${unit.bgColor} animate-pulse`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 統計資訊 */}
      <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold">{BUSINESS_UNITS.length}</div>
              <div className="text-sm mt-1 opacity-90">事業體</div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold">10+</div>
              <div className="text-sm mt-1 opacity-90">產業領域</div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-0">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold">∞</div>
              <div className="text-sm mt-1 opacity-90">創新精神</div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white border-0">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold">🚀</div>
              <div className="text-sm mt-1 opacity-90">持續成長</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 企業理念 */}
      <Card className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 border-2">
        <CardContent className="pt-6">
          <div className="text-center space-y-3">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              企業理念
            </h3>
            <p className="text-lg text-gray-700 dark:text-gray-300 max-w-3xl mx-auto">
              「從基礎做起,用創新突破」
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              水電大亨秉持著踏實經營、勇於創新的精神,從傳統產業出發,整合現代科技,
              打造多元化的事業版圖,為社會創造更大的價值。
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
