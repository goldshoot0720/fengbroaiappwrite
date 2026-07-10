'use client';

import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, Building2, Briefcase, Award, Target } from 'lucide-react';
import Image from 'next/image';

export default function CEOProfile() {
  const shareholdingPercentage = 37;

  return (
    <div className="space-y-6">
      {/* 標題區 */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-indigo-500 to-blue-600 rounded-full shadow-lg">
          <Briefcase className="w-8 h-8 text-white" />
          <h1 className="text-3xl font-bold text-white">執行長簡介</h1>
        </div>
        <p className="text-xl text-gray-600 dark:text-gray-400">人工智慧水電行執行長</p>
      </div>

      {/* 主要卡片 */}
      <Card className="overflow-hidden bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-950/30 border-2 border-indigo-200 dark:border-indigo-800">
        <CardContent className="p-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 左側：照片區 */}
            <div className="p-8 flex items-center justify-center bg-gradient-to-br from-indigo-100 to-blue-100 dark:from-indigo-900/20 dark:to-blue-900/20">
              <div className="relative">
                <div className="w-72 h-72 rounded-3xl overflow-hidden border-4 border-indigo-500 shadow-2xl bg-white">
                  <Image
                    src="/ceo-profile.jpg"
                    alt="人工智慧水電行執行長"
                    width={400}
                    height={400}
                    className="w-full h-full object-cover object-center"
                    priority
                  />
                </div>
                <div className="absolute -bottom-4 -right-4 bg-gradient-to-r from-indigo-500 to-blue-600 rounded-2xl px-4 py-3 shadow-2xl">
                  <div className="flex items-center gap-2">
                    <Award className="w-6 h-6 text-white" />
                    <span className="text-white font-bold text-lg">CEO</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 右側：資訊區 */}
            <div className="p-8 flex flex-col justify-center space-y-6">
              {/* 職位資訊 */}
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <Building2 className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    人工智慧水電行
                  </h2>
                </div>
                <div className="flex items-center gap-2 text-lg text-gray-700 dark:text-gray-300">
                  <Briefcase className="w-5 h-5 text-indigo-500" />
                  <span className="font-semibold">執行長 (CEO)</span>
                </div>
              </div>

              {/* 持股比例 - 重點區塊 */}
              <Card className="bg-gradient-to-r from-green-500 to-emerald-600 border-0 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-white/90 text-sm mb-2">
                        <TrendingUp className="w-4 h-4" />
                        <span>持股比例</span>
                      </div>
                      <div className="text-5xl font-bold text-white">
                        {shareholdingPercentage}%
                        <span className="text-2xl ml-2 text-white/80">以上</span>
                      </div>
                    </div>
                    <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center">
                      <TrendingUp className="w-12 h-12 text-white" />
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-white/20">
                    <p className="text-white/90 text-sm">
                      作為公司最大股東與執行長，引領企業邁向 AI 智能化轉型
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* 持股視覺化 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                  <span>股權結構</span>
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                    控股股東
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-6 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-green-500 to-emerald-600 h-full rounded-full flex items-center justify-end px-3 transition-all duration-1000 ease-out"
                    style={{ width: `${shareholdingPercentage}%` }}
                  >
                    <span className="text-white text-xs font-bold">
                      {shareholdingPercentage}%+
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <div className="text-left">0%</div>
                  <div className="text-center">50%</div>
                  <div className="text-right">100%</div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 領導特質 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/20 border-purple-200 dark:border-purple-800">
          <CardContent className="pt-6">
            <div className="text-center space-y-3">
              <div className="w-12 h-12 bg-purple-500 rounded-xl flex items-center justify-center mx-auto">
                <Target className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                策略願景
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                引領公司朝向 AI 與自動化轉型，創新水電產業服務模式
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-6">
            <div className="text-center space-y-3">
              <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center mx-auto">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                產業經驗
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                深耕水電工程領域，結合傳統技術與現代科技創新
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/20 border-green-200 dark:border-green-800">
          <CardContent className="pt-6">
            <div className="text-center space-y-3">
              <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center mx-auto">
                <Award className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                卓越領導
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                以身作則，帶領團隊追求卓越，建立企業文化與價值
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 底部說明 */}
      <Card className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 border-2">
        <CardContent className="pt-6">
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
              <Building2 className="w-5 h-5" />
              <span className="font-semibold">人工智慧水電行</span>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300 max-w-2xl mx-auto leading-relaxed">
              結合傳統水電工程技術與現代人工智慧科技，打造智能化服務平台，
              為客戶提供更快速、精準、可靠的水電工程解決方案。
            </p>
            <div className="pt-3 flex items-center justify-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <TrendingUp className="w-4 h-4" />
              <span>持續創新 • 引領產業</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
