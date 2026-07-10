'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Heart, Sparkles } from 'lucide-react';
import Image from 'next/image';

interface Cat {
  id: string;
  name: string;
  type: string;
  image: string;
  description: string;
  personality: string[];
  favoriteThings: string[];
}

const CATS: Cat[] = [
  {
    id: 'bubu',
    name: '喵布布',
    type: '三花貓',
    image: '/cats2.25fimage1.jpg',
    description: '可愛的三花貓,擁有白色、橘色和黑色的美麗毛色,正在跟你打招呼呢!',
    personality: ['活潑', '好奇', '親人'],
    favoriteThings: ['曬太陽', '玩逗貓棒', '吃小魚乾'],
  },
  {
    id: 'baibai',
    name: '喵白白',
    type: '白貓',
    image: '/cats2.25fimage2.jpg',
    description: '優雅的白貓,頭上和尾巴有黑色斑紋,穿著可愛的貓咪裝',
    personality: ['溫柔', '優雅', '慵懶'],
    favoriteThings: ['睡覺', '被摸摸', '吃罐罐'],
  },
];

export default function CatShowcase() {
  return (
    <div className="space-y-6">
      {/* 標題區 */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full shadow-lg">
          <Heart className="w-8 h-8 text-white" fill="white" />
          <h1 className="text-3xl font-bold text-white">鋒兄的貓咪家族</h1>
          <Heart className="w-8 h-8 text-white" fill="white" />
        </div>
        <p className="text-xl text-gray-600 dark:text-gray-400">兩隻可愛的毛孩子</p>
        <p className="text-sm text-gray-500 dark:text-gray-500 max-w-2xl mx-auto">
          歡迎來到喵星人的世界!認識鋒兄最愛的兩個小寶貝 🐱
        </p>
      </div>

      {/* 貓咪卡片網格 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {CATS.map((cat, index) => (
          <Card
            key={cat.id}
            className={`overflow-hidden hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] ${
              index === 0
                ? 'bg-gradient-to-br from-orange-50 to-pink-50 dark:from-orange-950/30 dark:to-pink-950/30 border-orange-200 dark:border-orange-800'
                : 'bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 border-blue-200 dark:border-blue-800'
            } border-2`}
          >
            <CardContent className="p-0">
              {/* 貓咪圖片 */}
              <div className="relative h-80 sm:h-96 overflow-hidden bg-gradient-to-b from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative w-full h-full">
                    <Image
                      src={cat.image}
                      alt={cat.name}
                      fill
                      className="object-cover"
                      sizes="(max-width: 1024px) 100vw, 50vw"
                      priority={index === 0}
                    />
                  </div>
                </div>
                {/* 閃爍特效 */}
                <div className="absolute top-4 right-4">
                  <Sparkles className="w-8 h-8 text-yellow-400 animate-pulse" />
                </div>
              </div>

              {/* 貓咪資訊 */}
              <div className="p-6 space-y-4">
                {/* 名稱與類型 */}
                <div className="text-center">
                  <h2 className={`text-3xl font-bold mb-2 ${
                    index === 0
                      ? 'text-orange-600 dark:text-orange-400'
                      : 'text-blue-600 dark:text-blue-400'
                  }`}>
                    {cat.name}
                  </h2>
                  <span className={`inline-block px-4 py-1 rounded-full text-sm font-semibold ${
                    index === 0
                      ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                  }`}>
                    {cat.type}
                  </span>
                </div>

                {/* 描述 */}
                <p className="text-center text-gray-700 dark:text-gray-300 leading-relaxed">
                  {cat.description}
                </p>

                {/* 性格特點 */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2 flex items-center gap-2">
                    <Heart className="w-4 h-4" />
                    性格特點
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {cat.personality.map((trait) => (
                      <span
                        key={trait}
                        className={`px-3 py-1 rounded-lg text-xs font-medium ${
                          index === 0
                            ? 'bg-orange-200 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200'
                            : 'bg-blue-200 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200'
                        }`}
                      >
                        {trait}
                      </span>
                    ))}
                  </div>
                </div>

                {/* 喜歡的事物 */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    最愛的事物
                  </h3>
                  <div className="space-y-1">
                    {cat.favoriteThings.map((thing, i) => (
                      <div
                        key={thing}
                        className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                      >
                        <span className={`w-2 h-2 rounded-full ${
                          index === 0
                            ? 'bg-orange-400'
                            : 'bg-blue-400'
                        }`} />
                        {thing}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 底部裝飾 */}
      <div className="text-center py-8">
        <div className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-pink-100 to-purple-100 dark:from-pink-900/20 dark:to-purple-900/20 rounded-2xl border-2 border-pink-200 dark:border-pink-800">
          <Heart className="w-6 h-6 text-pink-500 dark:text-pink-400" fill="currentColor" />
          <p className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            愛護動物,從你我做起 🐾
          </p>
          <Heart className="w-6 h-6 text-pink-500 dark:text-pink-400" fill="currentColor" />
        </div>
      </div>

      {/* 貓咪小知識 */}
      <Card className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-950/20 dark:to-orange-950/20 border-2 border-yellow-200 dark:border-yellow-800">
        <CardContent className="pt-6">
          <div className="text-center space-y-3">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center justify-center gap-2">
              <Sparkles className="w-6 h-6 text-yellow-500" />
              貓咪小知識
              <Sparkles className="w-6 h-6 text-yellow-500" />
            </h3>
            <div className="max-w-3xl mx-auto space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <p>🐱 <strong>三花貓</strong>:幾乎都是母貓,因為三色毛色基因與X染色體有關</p>
              <p>😺 <strong>白貓</strong>:有些白貓可能先天聽力較弱,需要特別照顧</p>
              <p>💕 貓咪每天需要12-16小時的睡眠時間</p>
              <p>🎵 貓咪的呼嚕聲頻率(25-150 Hz)有助於舒緩壓力和促進骨骼癒合</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
