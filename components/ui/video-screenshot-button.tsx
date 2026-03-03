'use client';

import { useState } from 'react';
import { Camera, Download } from 'lucide-react';

interface VideoScreenshotButtonProps {
  videoTitle: string;
  onScreenshotTaken?: (imageUrl: string, timestamp: number) => void;
}

export function VideoScreenshotButton({ videoTitle, onScreenshotTaken }: VideoScreenshotButtonProps) {
  const [capturing, setCapturing] = useState(false);

  const captureScreenshot = async () => {
    setCapturing(true);
    try {
      // Find the video element (Plyr wraps it)
      const videoElement = document.querySelector('video') as HTMLVideoElement;

      if (!videoElement) {
        alert('找不到影片元素');
        return;
      }

      // Get current time
      const currentTime = videoElement.currentTime;
      const minutes = Math.floor(currentTime / 60);
      const seconds = Math.floor(currentTime % 60);
      const milliseconds = Math.floor((currentTime % 1) * 1000);
      const timeString = `${minutes.toString().padStart(2, '0')}-${seconds.toString().padStart(2, '0')}-${milliseconds.toString().padStart(3, '0')}`;

      // Create canvas with video dimensions
      const canvas = document.createElement('canvas');
      canvas.width = videoElement.videoWidth;
      canvas.height = videoElement.videoHeight;

      // Draw current video frame
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        alert('無法創建畫布');
        return;
      }

      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

      // Convert to blob
      canvas.toBlob((blob) => {
        if (!blob) {
          alert('截圖失敗');
          return;
        }

        // Create download link
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const sanitizedTitle = videoTitle.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
        link.download = `${sanitizedTitle}_${timeString}.png`;
        link.href = url;
        link.click();

        // Clean up
        URL.revokeObjectURL(url);

        // Callback for potential future features (e.g., save to gallery)
        if (onScreenshotTaken) {
          onScreenshotTaken(url, currentTime);
        }

        // Show success message
        const message = document.createElement('div');
        message.className = 'fixed top-20 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-[101] flex items-center gap-2 animate-in fade-in slide-in-from-top duration-300';
        message.innerHTML = `
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
          </svg>
          <span>截圖成功！時間點: ${minutes}:${seconds.toString().padStart(2, '0')}</span>
        `;
        document.body.appendChild(message);
        setTimeout(() => {
          message.remove();
        }, 3000);
      }, 'image/png');

    } catch (error) {
      console.error('截圖錯誤:', error);
      alert('截圖失敗，請重試');
    } finally {
      setCapturing(false);
    }
  };

  return (
    <button
      onClick={captureScreenshot}
      disabled={capturing}
      className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-lg transition-colors shadow-lg hover:shadow-xl disabled:cursor-not-allowed"
      title="截取當前畫面"
    >
      {capturing ? (
        <>
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">截圖中...</span>
        </>
      ) : (
        <>
          <Camera className="w-4 h-4" />
          <span className="text-sm font-medium">截圖</span>
        </>
      )}
    </button>
  );
}
