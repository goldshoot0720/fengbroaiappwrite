"use client";

import { useState, useRef, useEffect } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize } from "lucide-react";

interface SimpleVideoPlayerProps {
  src: string;
  title: string;
}

export default function SimpleVideoPlayer({ src, title }: SimpleVideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [showControls, setShowControls] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const volumeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateTime = () => setCurrentTime(video.currentTime);
    const updateDuration = () => setDuration(video.duration);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleVolumeChange = () => {
      setVolume(video.volume);
      setIsMuted(video.muted);
    };

    video.addEventListener('timeupdate', updateTime);
    video.addEventListener('loadedmetadata', updateDuration);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('volumechange', handleVolumeChange);

    return () => {
      video.removeEventListener('timeupdate', updateTime);
      video.removeEventListener('loadedmetadata', updateDuration);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('volumechange', handleVolumeChange);
    };
  }, [src]);

  const formatTime = (time: number): string => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = !video.muted;
  };

  const toggleFullscreen = () => {
    const video = videoRef.current;
    if (!video) return;

    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      video.requestFullscreen();
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    const progressBar = progressRef.current;
    if (!video || !progressBar || !duration) return;

    const rect = progressBar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * duration;
    
    video.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleProgressMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    handleProgressClick(e);
  };

  const handleProgressMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    handleProgressClick(e);
  };

  const handleProgressMouseUp = () => {
    setIsDragging(false);
  };

  const handleVolumeClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    const volumeBar = volumeRef.current;
    if (!video || !volumeBar) return;

    const rect = volumeBar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    
    video.volume = percentage;
    video.muted = percentage === 0;
  };

  return (
    <div 
      className="relative bg-black rounded-2xl overflow-hidden group"
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      <video
        ref={videoRef}
        src={src}
        className="w-full aspect-video cursor-pointer"
        onClick={togglePlayPause}
        onDoubleClick={toggleFullscreen}
      />
      
      {/* 響應式標題覆蓋層 */}
      <div className={`absolute top-2 sm:top-4 left-2 sm:left-4 right-2 sm:right-4 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        <h3 className="text-white font-semibold text-sm sm:text-lg drop-shadow-lg truncate">{title}</h3>
      </div>

      {/* 響應式中央播放按鈕 */}
      <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${showControls && !isPlaying ? 'opacity-100' : 'opacity-0'}`}>
        <button
          onClick={togglePlayPause}
          className="w-12 h-12 sm:w-16 sm:h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 transition-all duration-200 touch-manipulation"
        >
          <Play className="text-white ml-0.5 sm:ml-1 w-5 h-5 sm:w-6 sm:h-6" />
        </button>
      </div>

      {/* 響應式底部控制欄 */}
      <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 sm:p-4 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        
        {/* 響應式可點選時間軸進度條 */}
        <div className="mb-2 sm:mb-3">
          <div 
            ref={progressRef}
            className="relative h-1.5 sm:h-2 bg-white/20 rounded-full cursor-pointer hover:h-2 sm:hover:h-3 transition-all duration-200 touch-manipulation"
            onClick={handleProgressClick}
            onMouseDown={handleProgressMouseDown}
            onMouseMove={handleProgressMouseMove}
            onMouseUp={handleProgressMouseUp}
            onMouseLeave={handleProgressMouseUp}
          >
            {/* 進度背景 */}
            <div className="absolute inset-0 bg-white/20 rounded-full"></div>
            
            {/* 已播放進度 */}
            <div 
              className="absolute left-0 top-0 h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-150"
              style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }}
            ></div>
            
            {/* 響應式進度拖拽點 */}
            <div 
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 sm:w-4 sm:h-4 bg-white rounded-full shadow-lg opacity-0 hover:opacity-100 transition-opacity duration-200"
              style={{ left: duration ? `${(currentTime / duration) * 100}%` : '0%', transform: 'translateX(-50%) translateY(-50%)' }}
            ></div>
          </div>
          
          {/* 響應式時間顯示 */}
          <div className="flex justify-between text-white text-xs sm:text-sm mt-1 sm:mt-2">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* 響應式控制按鈕列 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            {/* 響應式播放/暫停按鈕 */}
            <button
              onClick={togglePlayPause}
              className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 transition-all duration-200 touch-manipulation"
            >
              {isPlaying ? (
                <Pause className="text-white" size={16} />
              ) : (
                <Play className="text-white ml-0.5" size={16} />
              )}
            </button>

            {/* 響應式音量控制 */}
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                onClick={toggleMute}
                className="w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center hover:bg-white/20 rounded transition-all duration-200 touch-manipulation"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="text-white" size={14} />
                ) : (
                  <Volume2 className="text-white" size={14} />
                )}
              </button>
              
              {/* 響應式音量滑桿 */}
              <div 
                ref={volumeRef}
                className="w-12 sm:w-16 h-1 bg-white/20 rounded-full cursor-pointer hover:h-1.5 sm:hover:h-2 transition-all duration-200 touch-manipulation"
                onClick={handleVolumeClick}
              >
                <div 
                  className="h-full bg-white rounded-full transition-all duration-150"
                  style={{ width: `${volume * 100}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* 響應式右側控制按鈕 */}
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={toggleFullscreen}
              className="w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center hover:bg-white/20 rounded transition-all duration-200 touch-manipulation"
            >
              <Maximize className="text-white" size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* 載入指示器 */}
      {!duration && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  );
}