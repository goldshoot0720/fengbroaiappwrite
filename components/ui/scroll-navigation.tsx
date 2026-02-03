"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown, ArrowUp, ArrowDown } from "lucide-react";

interface ScrollNavigationProps {
  containerId?: string;
  showThreshold?: number;
  showProgress?: boolean;
}

export default function ScrollNavigation({ 
  containerId,
  showThreshold = 300,
  showProgress = true
}: ScrollNavigationProps) {
  const [showButtons, setShowButtons] = useState(false);
  const [isAtTop, setIsAtTop] = useState(true);
  const [isAtBottom, setIsAtBottom] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.pageYOffset;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollPercent = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;

      // 顯示按鈕的條件
      setShowButtons(scrollTop > showThreshold);
      
      // 檢查是否在頂部
      setIsAtTop(scrollTop <= 10);
      
      // 檢查是否在底部
      setIsAtBottom(scrollTop + window.innerHeight >= document.documentElement.scrollHeight - 10);
      
      // 設置滾動進度
      setScrollProgress(scrollPercent);
    };

    window.addEventListener('scroll', handleScroll);
    
    // 初始檢查
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [showThreshold]);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  const scrollToBottom = () => {
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: 'smooth'
    });
  };

  if (!showButtons) return null;

  return (
    <div className="fixed right-4 bottom-4 z-50 flex flex-col items-center gap-3">
      {/* 滾動進度指示器 */}
      {showProgress && (
        <div className="relative">
          <div className="w-12 h-12 rounded-full bg-white/90 backdrop-blur-sm border border-gray-200 shadow-lg flex items-center justify-center">
            <div className="text-xs font-medium text-gray-600">
              {Math.round(scrollProgress)}%
            </div>
          </div>
          <svg className="absolute inset-0 w-12 h-12 -rotate-90">
            <circle
              cx="24"
              cy="24"
              r="20"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              className="text-gray-200"
            />
            <circle
              cx="24"
              cy="24"
              r="20"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              strokeDasharray={`${2 * Math.PI * 20}`}
              strokeDashoffset={`${2 * Math.PI * 20 * (1 - scrollProgress / 100)}`}
              className="text-blue-500 transition-all duration-300"
            />
          </svg>
        </div>
      )}

      {/* 導航按鈕容器 */}
      <div className="flex flex-col gap-2">
        {/* 跳轉至頂部按鈕 */}
        {!isAtTop && (
          <Button
            onClick={scrollToTop}
            size="sm"
            className="group w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg shadow-blue-500/25 transition-all duration-200 hover:scale-110 active:scale-95"
            title="跳轉至頂部"
          >
            <ArrowUp size={18} className="group-hover:animate-bounce" />
          </Button>
        )}
        
        {/* 跳轉至底部按鈕 */}
        {!isAtBottom && (
          <Button
            onClick={scrollToBottom}
            size="sm"
            className="group w-12 h-12 rounded-full bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white shadow-lg shadow-gray-500/25 transition-all duration-200 hover:scale-110 active:scale-95"
            title="跳轉至底部"
          >
            <ArrowDown size={18} className="group-hover:animate-bounce" />
          </Button>
        )}
      </div>

      {/* 快速導航提示 */}
      <div className="hidden lg:block">
        <div className="bg-black/80 text-white text-xs px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none absolute right-14 bottom-0">
          快速導航
        </div>
      </div>
    </div>
  );
}