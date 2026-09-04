"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import "plyr/dist/plyr.css";

// 全域單一播放管理：當一個媒體開始播放時，暂停所有其他媒體
export const setupSinglePlayback = () => {
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
  onEnded?: () => void;
  persistOnUnmount?: boolean;
  onPersistPlayback?: (state: {
    src: string;
    currentTime: number;
    volume: number;
    playbackRate: number;
    loop: boolean;
    muted: boolean;
  }) => void;
  tracks?: Array<{
    kind: 'captions' | 'subtitles';
    label: string;
    srclang: string;
    src: string;
    default?: boolean;
  }>;
}

function appendMediaRetryParam(src: string, retry: number) {
  if (!src || src.startsWith("blob:") || src.startsWith("data:")) return src;
  const separator = src.includes("?") ? "&" : "?";
  return `${src}${separator}__media_retry=${retry}`;
}

function getMediaErrorMessage(error: MediaError | null) {
  switch (error?.code) {
    case MediaError.MEDIA_ERR_ABORTED:
      return "播放已中斷，請再試一次。";
    case MediaError.MEDIA_ERR_NETWORK:
      return "影片載入時網路不穩，請重新載入。";
    case MediaError.MEDIA_ERR_DECODE:
      return "瀏覽器無法解碼這個影片檔。";
    case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
      return "影片來源暫時無法播放，請重新載入或檢查檔案格式。";
    default:
      return "影片暫時無法播放，請重新載入。";
  }
}

export function PlyrPlayer({
  type,
  src,
  poster,
  loop = false,
  autoplay = false,
  className = "",
  onEnded,
  persistOnUnmount = false,
  onPersistPlayback,
  tracks = []
}: PlyrPlayerProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<'landscape' | 'portrait' | 'square'>('landscape');
  const [playbackError, setPlaybackError] = useState("");
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement>(null);
  const plyrRef = useRef<any>(null);
  const retryCountRef = useRef(0);
  const onPersistPlaybackRef = useRef(onPersistPlayback);

  useEffect(() => {
    onPersistPlaybackRef.current = onPersistPlayback;
  }, [onPersistPlayback]);

  const getPersistentMedia = useCallback((mediaType: "audio" | "video") => {
    if (typeof window === "undefined") return null;

    const persistentKey = mediaType === "video" ? "__fengbroPersistentVideo" : "__fengbroPersistentAudio";
    let persistentMedia = (window as any)[persistentKey] as HTMLMediaElement | undefined;

    if (!persistentMedia) {
      persistentMedia = document.createElement(mediaType);
      persistentMedia.preload = "auto";
      persistentMedia.className = "hidden";
      persistentMedia.setAttribute("data-persistent-media", mediaType);
      if (mediaType === "video") {
        (persistentMedia as HTMLVideoElement).playsInline = true;
      }
      document.body.appendChild(persistentMedia);
      (window as any)[persistentKey] = persistentMedia;
    }

    return persistentMedia;
  }, []);

  useEffect(() => {
    setIsMounted(true);
    setupSinglePlayback();
  }, []);

  useEffect(() => {
    retryCountRef.current = 0;
    setPlaybackError("");
  }, [src]);

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
      const media = mediaRef.current;
      if (
        persistOnUnmount &&
        media &&
        !media.paused &&
        media.currentSrc
      ) {
        onPersistPlaybackRef.current?.({
          src: media.currentSrc,
          currentTime: media.currentTime,
          volume: media.volume,
          playbackRate: media.playbackRate,
          loop: media.loop,
          muted: media.muted,
        });
        const persistentMedia = getPersistentMedia(type);
        if (persistentMedia) {
          persistentMedia.src = media.currentSrc;
          persistentMedia.currentTime = media.currentTime;
          persistentMedia.volume = media.volume;
          persistentMedia.playbackRate = media.playbackRate;
          persistentMedia.loop = media.loop;
          persistentMedia.muted = media.muted;
          if (type === "video" && persistentMedia instanceof HTMLVideoElement && media instanceof HTMLVideoElement) {
            persistentMedia.poster = media.poster;
          }
          persistentMedia.play().catch(() => {});
        }
      }
      if (plyrInstance) {
        try { plyrInstance.destroy(); } catch {}
      }
      plyrRef.current = null;
    };
  }, [getPersistentMedia, isMounted, persistOnUnmount, src, type]);

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

  useEffect(() => {
    const media = mediaRef.current;
    if (!media || !onEnded) return;

    media.addEventListener('ended', onEnded);
    return () => media.removeEventListener('ended', onEnded);
  }, [onEnded, src, type]);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media) return;

    let retryTimer: number | null = null;

    const handleCanPlay = () => {
      retryCountRef.current = 0;
      setPlaybackError("");
    };

    const handleError = () => {
      if (retryCountRef.current < 2) {
        retryCountRef.current += 1;
        const retrySrc = appendMediaRetryParam(src, retryCountRef.current);
        retryTimer = window.setTimeout(() => {
          media.src = retrySrc;
          media.load();
          if (autoplay) {
            void media.play().catch(() => {});
          }
        }, 600);
        return;
      }

      setPlaybackError(getMediaErrorMessage(media.error));
    };

    media.addEventListener("canplay", handleCanPlay);
    media.addEventListener("error", handleError);

    return () => {
      if (retryTimer) window.clearTimeout(retryTimer);
      media.removeEventListener("canplay", handleCanPlay);
      media.removeEventListener("error", handleError);
    };
  }, [autoplay, src]);

  const handleManualRetry = () => {
    const media = mediaRef.current;
    if (!media) return;

    retryCountRef.current = 0;
    setPlaybackError("");
    media.src = appendMediaRetryParam(src, Date.now());
    media.load();
    void media.play().catch(() => {});
  };

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
    <div className={`relative ${className} ${type === 'video' ? '[&_video]:object-contain' : ''}`}>
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
      {playbackError && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/75 p-4 text-center text-white">
          <div className="max-w-sm space-y-3">
            <p className="text-sm font-medium">{playbackError}</p>
            <button
              type="button"
              onClick={handleManualRetry}
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-gray-900 transition hover:bg-gray-100"
            >
              重新載入
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
