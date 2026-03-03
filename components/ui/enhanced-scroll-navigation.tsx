"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowUp, ArrowDown, List, Plus } from "lucide-react";

interface QuickNavItem {
  id: string;
  label: string;
  elementId: string;
}

interface EnhancedScrollNavigationProps {
  showThreshold?: number;
  showProgress?: boolean;
  quickNavItems?: QuickNavItem[];
}

export default function EnhancedScrollNavigation({ 
  showThreshold = 300,
  showProgress = true,
  quickNavItems = []
}: EnhancedScrollNavigationProps) {
  const [showButtons, setShowButtons] = useState(false);
  const [isAtTop, setIsAtTop] = useState(true);
  const [isAtBottom, setIsAtBottom] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [showQuickNav, setShowQuickNav] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.pageYOffset;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollPercent = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;

      setShowButtons(scrollTop > showThreshold);
      setIsAtTop(scrollTop <= 10);
      setIsAtBottom(scrollTop + window.innerHeight >= document.documentElement.scrollHeight - 10);
      setScrollProgress(scrollPercent);
    };

    window.addEventListener('scroll', handleScroll);
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

  const scrollToElement = (elementId: string) => {
    const element = document.getElementById(elementId);
    if (element) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
    setShowQuickNav(false);
  };

  if (!showButtons) return null;

  return (
    <div className="fixed right-2 sm:right-4 bottom-4 z-50 flex flex-col items-end gap-3 tablet-8-7">
      {/* 快速導航選單 */}
      {showQuickNav && quickNavItems.length > 0 && (
        <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-2xl shadow-xl p-2 mb-2 min-w-[200px] max-w-[250px] sm:min-w-[220px]">
          <div className="text-xs font-medium text-gray-500 px-3 py-2 border-b border-gray-100">
            快速導航
          </div>
          <div className="py-1 max-h-60 overflow-y-auto">
            {quickNavItems.map((item) => (
              <button
                key={item.id}
                onClick={() => scrollToElement(item.elementId)}
                className="w-full text-left px-3 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors duration-150 touch-manipulation"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col items-center gap-3">
        {/* 滾動進度指示器 */}
        {showProgress && (
          <div className="relative">
            <div className="w-14 h-14 rounded-full bg-white/95 backdrop-blur-sm border border-gray-200 shadow-lg flex items-center justify-center">
              <div className="text-xs font-semibold text-gray-700">
                {Math.round(scrollProgress)}%
              </div>
            </div>
            <svg className="absolute inset-0 w-14 h-14 -rotate-90">
              <circle
                cx="28"
                cy="28"
                r="24"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                className="text-gray-200"
              />
              <circle
                cx="28"
                cy="28"
                r="24"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 24}`}
                strokeDashoffset={`${2 * Math.PI * 24 * (1 - scrollProgress / 100)}`}
                className="text-blue-500 transition-all duration-300"
                strokeLinecap="round"
              />
            </svg>
          </div>
        )}

        {/* 導航按鈕容器 */}
        <div className="flex flex-col gap-2">
          {/* 快速導航按鈕 */}
          {quickNavItems.length > 0 && (
            <Button
              onClick={() => setShowQuickNav(!showQuickNav)}
              size="sm"
              variant={showQuickNav ? "default" : "outline"}
              className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full transition-all duration-200 hover:scale-110 active:scale-95 touch-manipulation ${
                showQuickNav 
                  ? "bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white shadow-lg shadow-purple-500/25" 
                  : "bg-white/95 backdrop-blur-sm border-gray-200 hover:bg-gray-50 shadow-lg"
              }`}
              title="快速導航選單"
            >
              <List size={18} className={showQuickNav ? "rotate-90" : ""} style={{ transition: "transform 0.2s" }} />
            </Button>
          )}

          {/* 跳轉至頂部按鈕 */}
          {!isAtTop && (
            <Button
              onClick={scrollToTop}
              size="sm"
              className="group w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg shadow-blue-500/25 transition-all duration-200 hover:scale-110 active:scale-95 touch-manipulation"
              title="跳轉至頂部"
            >
              <ArrowUp size={18} className="group-hover:-translate-y-0.5 transition-transform duration-200" />
            </Button>
          )}
          
          {/* 跳轉至底部按鈕 */}
          {!isAtBottom && (
            <Button
              onClick={scrollToBottom}
              size="sm"
              className="group w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white shadow-lg shadow-gray-500/25 transition-all duration-200 hover:scale-110 active:scale-95 touch-manipulation"
              title="跳轉至底部"
            >
              <ArrowDown size={18} className="group-hover:translate-y-0.5 transition-transform duration-200" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}