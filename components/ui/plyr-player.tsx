"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import "plyr/dist/plyr.css";

// 全域單一播放管理：當一個媒體開始播放時，暂停所有其他媒體
const setupSinglePlayback = () => {
  if (typeof window === 'undefined') return;

  // 避免重複設置
  if ((window as any).__singlePlaybackSetup) return;
  (window as any).__singlePlaybackSetup = true;

  document.addEventListener('play', (e) => {
    const target = e.target as HTMLMediaElement;
    if (target.tagName === 'AUDIO' || target.tagName === 'VIDEO') {
      // 暂停所有其他的 audio 和 video 元素
      const allMedia = document.querySelectorAll('audio, video');
      allMedia.forEach((media) => {
        if (media !== target && !(media as HTMLMediaElement).paused) {
          (media as HTMLMediaElement).pause();
        }
      });
    }
  }, true);
};

interface PlyrPlayerProps {
  type: "video" | "audio";
  src: string;
  poster?: string;
  loop?: boolean;
  autoplay?: boolean;
  className?: string;
  tracks?: Array<{
    kind: 'captions' | 'subtitles';
    label: string;
    srclang: string;
    src: string;
    default?: boolean;
  }>;
}

export function PlyrPlayer({
  type,
  src,
  poster,
  loop = false,
  autoplay = false,
  className = "",
  tracks = []
}: PlyrPlayerProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<'landscape' | 'portrait' | 'square'>('landscape');
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement>(null);
  const plyrRef = useRef<any>(null);

  useEffect(() => {
    setIsMounted(true);
    setupSinglePlayback();
  }, []);

  // 初始化 Plyr（直接使用 plyr 庫，繞過 plyr-react 的 selector bug）
  useEffect(() => {
    if (!isMounted || !mediaRef.current) return;

    let plyrInstance: any = null;

    const initPlyr = async () => {
      const PlyrLib = (await import("plyr")).default;

      // 確保 DOM 元素仍然存在
      if (!mediaRef.current) return;

      plyrInstance = new PlyrLib(mediaRef.current, {
        controls: [
          'play-large',
          'play',
          'progress',
          'current-time',
          'duration',
          'mute',
          'volume',
          'captions',
          'settings',
          'fullscreen'
        ],
        settings: ['captions', 'quality', 'speed', 'loop'],
        captions: { active: true, update: true, language: 'auto' },
        loop: { active: loop },
        autoplay: autoplay,
        speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 2] },
        keyboard: { focused: true, global: false },
        tooltips: { controls: true, seek: true }
      });

      plyrRef.current = plyrInstance;
    };

    initPlyr();

    return () => {
      if (plyrInstance) {
        try { plyrInstance.destroy(); } catch {}
      }
      plyrRef.current = null;
    };
  }, [isMounted, src, type]);

  // 更新 loop 設定
  useEffect(() => {
    if (plyrRef.current) {
      plyrRef.current.loop = loop;
    }
  }, [loop]);

  // Detect video aspect ratio
  useEffect(() => {
    if (type === 'video' && mediaRef.current && mediaRef.current.tagName === 'VIDEO') {
      const video = mediaRef.current as HTMLVideoElement;
      const handleLoadedMetadata = () => {
        const width = video.videoWidth;
        const height = video.videoHeight;
        const ratio = width / height;

        if (ratio > 1.2) {
          setAspectRatio('landscape');
        } else if (ratio < 0.8) {
          setAspectRatio('portrait');
        } else {
          setAspectRatio('square');
        }
      };

      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      return () => video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    }
  }, [type, src]);

  if (!isMounted) {
    return (
      <div className={className}>
        {type === 'video' ? (
          <video
            controls
            src={src}
            poster={poster}
            preload="metadata"
            className="w-full rounded-lg"
          />
        ) : (
          <audio controls src={src} preload="metadata" className="w-full" />
        )}
      </div>
    );
  }

  return (
    <div className={`${className} ${type === 'video' ? '[&_video]:object-contain' : ''}`}>
      {type === 'video' ? (
        <video
          ref={mediaRef as React.RefObject<HTMLVideoElement>}
          src={src}
          poster={poster}
          playsInline
          preload="metadata"
        >
          {tracks.map((track, i) => (
            <track
              key={i}
              kind={track.kind}
              label={track.label}
              srcLang={track.srclang}
              src={track.src}
              default={track.default}
            />
          ))}
        </video>
      ) : (
        <audio
          ref={mediaRef as React.RefObject<HTMLAudioElement>}
          src={src}
          preload="metadata"
        />
      )}
    </div>
  );
}
