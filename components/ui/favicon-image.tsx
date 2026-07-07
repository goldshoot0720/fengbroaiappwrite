"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { getFaviconUrlsOrdered } from "@/lib/faviconUtils";

interface FaviconImageProps {
  siteUrl: string;
  siteName: string;
  size?: number;
  className?: string;
}

export function FaviconImage({ siteUrl, siteName, size = 20, className = "" }: FaviconImageProps) {
  const [faviconUrls, setFaviconUrls] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [allFailed, setAllFailed] = useState(false);

  useEffect(() => {
    if (!siteUrl) {
      setIsLoading(false);
      setAllFailed(true);
      return;
    }

    // Get ordered list of favicon URLs to try
    const urls = getFaviconUrlsOrdered(siteUrl);
    setFaviconUrls(urls);
    setCurrentIndex(0);
    setAllFailed(false);
    setIsLoading(false);
  }, [siteUrl]);

  const handleError = () => {
    // Try next URL in the list
    const nextIndex = currentIndex + 1;
    if (nextIndex < faviconUrls.length) {
      setCurrentIndex(nextIndex);
    } else {
      // All URLs failed, show default icon
      setAllFailed(true);
    }
  };

  const handleLoad = () => {
    // Successfully loaded, keep current URL
  };

  const currentUrl = faviconUrls[currentIndex];

  if (isLoading || !currentUrl || allFailed) {
    // 顯示預設圖示
    return (
      <div 
        className={`inline-flex items-center justify-center bg-gray-200 dark:bg-gray-700 rounded-sm ${className}`}
        style={{ width: size, height: size }}
      >
        <span className="text-xs text-gray-500 dark:text-gray-400">🌐</span>
      </div>
    );
  }

  return (
    <Image
      key={currentUrl} // Force re-render when URL changes
      src={currentUrl}
      alt={`${siteName} favicon`}
      width={size}
      height={size}
      className={`rounded-sm ${className}`}
      onError={handleError}
      onLoad={handleLoad}
      unoptimized // 因為是外部圖片，使用 unoptimized
    />
  );
}