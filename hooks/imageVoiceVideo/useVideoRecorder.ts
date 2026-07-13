'use client';
import { useCallback, useRef } from 'react';
import { fetchTTSBatch, fetchTranslate, fetchConvert } from '@/lib/imageVoiceVideo/api';
import {
  FRAME_INTERVAL_MS,
  VIDEO_FPS,
  mediaRecorderBitrateOptions,
} from '@/lib/imageVoiceVideo/videoQuality';
import {
  activeSubtitlesForElapsed,
  computeSegmentStarts,
} from '@/lib/imageVoiceVideo/subtitleTiming';
import type { ScriptLine, Track, Gender } from '@/lib/imageVoiceVideo/scriptParser';
import { useCanvasRenderer } from './useCanvasRenderer';

export interface RecordingOptions {
  scriptLines: ScriptLine[];
  tracks: Track[];
  image: HTMLImageElement | null;
  canvas: HTMLCanvasElement;
  format: 'mp4' | 'webm';
  rate: number;
  volume: number;
  scriptLanguage: string;
}

export interface RecordingResult {
  blob: Blob;
  ext: string;
  duration: number;
}

type CanvasCaptureTrack = MediaStreamTrack & { requestFrame?: () => void };

function chooseMime(fmt: string): { mimeType: string; ext: string } {
  if (fmt === 'mp4') {
    const mp4Types = ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4'];
    const found = mp4Types.find(t => MediaRecorder.isTypeSupported(t));
    if (found) return { mimeType: found, ext: 'mp4' };
  }
  const webmTypes = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  const found = webmTypes.find(t => MediaRecorder.isTypeSupported(t));
  return { mimeType: found ?? 'video/webm', ext: 'webm' };
}

function resolveGender(line: ScriptLine, track: Track): Gender {
  return line.gender ?? track.gender;
}

function stopTracks(stream: MediaStream | null | undefined, kinds?: Array<'audio' | 'video'>) {
  if (!stream) return;
  for (const track of stream.getTracks()) {
    if (kinds && !kinds.includes(track.kind as 'audio' | 'video')) continue;
    try {
      track.stop();
    } catch {
      /* ignore */
    }
  }
}

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

function requestCanvasFrame(stream: MediaStream) {
  const track = stream.getVideoTracks()[0] as CanvasCaptureTrack | undefined;
  if (track?.requestFrame) {
    try {
      track.requestFrame();
    } catch {
      /* ignore */
    }
  }
}

/**
 * Always create a fresh capture stream for each recording.
 * Reusing a previous track often yields 0-duration / empty WebM in Chrome.
 *
 * Prefer frameRate 0 + requestFrame() so each paint is encoded (auto fps can
 * stick on the first frame in some Chromium paths). Fall back to VIDEO_FPS
 * when requestFrame is unavailable.
 */
function createCanvasStream(canvas: HTMLCanvasElement): MediaStream {
  const probe = canvas.captureStream(0);
  const probeTrack = probe.getVideoTracks()[0] as CanvasCaptureTrack | undefined;
  if (probeTrack?.requestFrame) {
    return probe;
  }
  stopTracks(probe, ['video']);
  return canvas.captureStream(VIDEO_FPS);
}

export function useVideoRecorder(onStatus: (msg: string) => void) {
  const abortRef = useRef(false);
  const busyRef = useRef(false);
  const { drawFrame } = useCanvasRenderer();

  const record = useCallback(async (opts: RecordingOptions): Promise<RecordingResult> => {
    if (busyRef.current) {
      throw new Error('正在生成中，請稍候');
    }
    busyRef.current = true;
    abortRef.current = false;

    const {
      scriptLines, tracks, image, canvas,
      format, rate, volume, scriptLanguage,
    } = opts;

    const { mimeType, ext } = chooseMime(format);
    let currentExt = ext;

    let audioContext: AudioContext | null = null;
    let destination: MediaStreamAudioDestinationNode | null = null;
    let canvasStream: MediaStream | null = null;
    let mixedStream: MediaStream | null = null;
    let recorder: MediaRecorder | null = null;
    const resources: {
      worker: Worker | null;
      workerUrl: string | null;
      timer: ReturnType<typeof setTimeout> | null;
    } = {
      worker: null,
      workerUrl: null,
      timer: null,
    };

    try {
      // ── 0. Unlock AudioContext immediately to preserve user gesture ──
      audioContext = new AudioContext();
      await audioContext.resume();
      // Keep context running (do NOT suspend). A suspended context during
      // MediaRecorder setup can produce silent / 0-length audio tracks.

      // ── 1. Build spoken text per language track ─────────────────
      onStatus('正在翻譯字幕…');
      const spokenByTrack: string[][] = [];

      for (const track of tracks) {
        let spoken: string[];
        if (track.language === scriptLanguage) {
          spoken = scriptLines.map(l => l.text);
        } else {
          spoken = await fetchTranslate(
            scriptLines.map(l => l.text),
            track.language,
            scriptLanguage,
          );
        }
        spokenByTrack.push(spoken);
      }

      // ── 2. Build audio (TTS) — batch per track ─────────────────
      onStatus('正在生成語音…');
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      destination = audioContext.createMediaStreamDestination();

      const gainValue = Math.min(0.85, 1 / Math.sqrt(Math.max(tracks.length, 1)));
      const segmentDurations: number[] = new Array(scriptLines.length).fill(0);
      const allSources: { source: AudioBufferSourceNode; startAt: number }[] = [];
      const trackBuffers: AudioBuffer[][] = [];

      for (let t = 0; t < tracks.length; t++) {
        const track = tracks[t];
        const spoken = spokenByTrack[t];
        if (abortRef.current) throw new Error('已取消');

        onStatus(`正在生成語音 ${track.label || track.language}…`);

        const items = spoken.map((text, i) => ({
          text,
          language: track.language,
          gender: resolveGender(scriptLines[i], track),
        }));

        const abs = await fetchTTSBatch(items, rate, volume, (done, total) => {
          onStatus(`正在生成語音 ${track.label || track.language} ${done}/${total}…`);
        });

        const buffers: AudioBuffer[] = [];
        for (const ab of abs) {
          const audioBuf = await audioContext.decodeAudioData(ab.slice(0));
          buffers.push(audioBuf);
        }
        trackBuffers.push(buffers);
      }

      for (let i = 0; i < scriptLines.length; i++) {
        const durs = trackBuffers.map(bufs => bufs[i]?.duration ?? 0);
        const maxDur = Math.max(...durs, 0.4);
        // Guard against NaN from a bad decode (Math.max(NaN, 0.4) === NaN)
        segmentDurations[i] = (Number.isFinite(maxDur) ? maxDur : 0.4) + 0.2;
      }

      const segmentStarts = computeSegmentStarts(segmentDurations);
      const trackLanguages = tracks.map(tr => tr.language);

      trackBuffers.forEach((buffers, trackIndex) => {
        buffers.forEach((buffer, lineIndex) => {
          const source = audioContext!.createBufferSource();
          source.buffer = buffer;

          const gain = audioContext!.createGain();
          gain.gain.value = gainValue;

          if (tracks.length > 1 && typeof audioContext!.createStereoPanner === 'function') {
            const panner = audioContext!.createStereoPanner();
            panner.pan.value =
              -0.85 + (1.7 * trackIndex) / Math.max(tracks.length - 1, 1);
            source.connect(gain).connect(panner).connect(destination!);
          } else {
            source.connect(gain).connect(destination!);
          }

          allSources.push({ source, startAt: segmentStarts[lineIndex] });
        });
      });

      const totalDuration = Math.max(
        1,
        segmentDurations.reduce((a, b) => a + b, 0),
      );

      /** Always paint only the cue(s) for the current speech segment (one per language). */
      const paintAt = (elapsedSec: number) => {
        const active = activeSubtitlesForElapsed(
          spokenByTrack,
          trackLanguages,
          segmentStarts,
          segmentDurations,
          elapsedSec,
        );
        // showAll=true: trust pre-selected current-segment cues (still ≤1 per language)
        drawFrame(canvas, image, active, elapsedSec, true);
      };

      // ── 3. Canvas stream + MediaRecorder ────────────────────────
      // Ensure context is running before we attach streams / start encoder
      if (audioContext.state !== 'running') {
        await audioContext.resume();
      }

      paintAt(0);

      canvasStream = createCanvasStream(canvas);
      // Paint + push a few frames so the first cluster isn't empty
      for (let i = 0; i < 3; i++) {
        paintAt(0);
        requestCanvasFrame(canvasStream);
        await sleep(20);
      }

      const liveVideo = canvasStream.getVideoTracks().filter(t => t.readyState === 'live');
      if (liveVideo.length === 0) {
        throw new Error('無法擷取畫面，請重新整理後再試');
      }

      const liveAudio = destination.stream.getAudioTracks().filter(t => t.readyState === 'live');
      if (liveAudio.length === 0) {
        throw new Error('無法擷取音訊，請重新整理後再試');
      }

      mixedStream = new MediaStream([...liveVideo, ...liveAudio]);

      const chunks: Blob[] = [];
      try {
        recorder = new MediaRecorder(mixedStream, {
          mimeType,
          // ≥ 1 Mbps (1024 Kbps) video + 128 kbps audio — see videoQuality.ts
          ...mediaRecorderBitrateOptions(),
        });
      } catch {
        recorder = new MediaRecorder(mixedStream);
        currentExt = 'webm';
      }

      recorder.ondataavailable = e => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      onStatus('正在錄製影片…');
      let audioStartTime = 0;
      const ctx = audioContext;
      const rec = recorder;
      const streamForFrames = canvasStream;

      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const finish = (err?: Error) => {
          if (settled) return;
          settled = true;
          if (resources.timer) {
            clearTimeout(resources.timer);
            resources.timer = null;
          }
          if (err) reject(err);
          else resolve();
        };

        const hardMs = Math.ceil(totalDuration * 1000) + 20_000;
        resources.timer = setTimeout(() => {
          try {
            if (rec.state === 'recording' || rec.state === 'paused') {
              try {
                rec.requestData();
              } catch {
                /* ignore */
              }
              rec.stop();
            }
          } catch {
            /* ignore */
          }
          setTimeout(() => {
            finish(new Error('錄製逾時，請再試一次（可改用 WebM 或減少句數）'));
          }, 1500);
        }, hardMs);

        rec.onerror = () => finish(new Error('MediaRecorder 發生錯誤'));
        rec.onstop = () => finish();

        rec.onstart = () => {
          // Schedule audio relative to the actual encoder start (avoids dropped head)
          void ctx.resume().then(() => {
            audioStartTime = ctx.currentTime;

            for (const { source, startAt } of allSources) {
              try {
                source.start(audioStartTime + startAt);
              } catch (e) {
                console.warn('source.start failed', e);
              }
            }

            // Wall-clock worker keeps painting even when the tab is backgrounded.
            // Interval must match VIDEO_FPS (≥24); 66ms was ~15fps and caused choppy MP4.
            const frameMs = FRAME_INTERVAL_MS;
            const workerCode = `
              let timer;
              self.onmessage = e => {
                if (e.data === 'start') timer = setInterval(() => self.postMessage('tick'), ${frameMs});
                if (e.data === 'stop')  { clearInterval(timer); self.close(); }
              };
            `;
            resources.workerUrl = URL.createObjectURL(
              new Blob([workerCode], { type: 'text/javascript' }),
            );
            resources.worker = new Worker(resources.workerUrl);

            // Prefer wall-clock elapsed for subtitles so progress stays correct
            // even if AudioContext is throttled slightly.
            const recordWallStart = performance.now();
            let lastStatusPct = -1;
            let lastStatusAt = 0;

            const paintElapsed = () => {
              const wallElapsed = (performance.now() - recordWallStart) / 1000;
              const audioElapsed = ctx.currentTime - audioStartTime;
              // Use the larger of the two so we never under-draw near the end
              const elapsed = Math.min(
                totalDuration,
                Math.max(wallElapsed, audioElapsed, 0),
              );
              const pct = Math.min(100, Math.round((elapsed / totalDuration) * 100));
              // Throttle React status updates — every frame setState can stall paints
              // and leave the encoder stuck on the first subtitle frame.
              const now = performance.now();
              if (pct !== lastStatusPct && now - lastStatusAt >= 200) {
                lastStatusPct = pct;
                lastStatusAt = now;
                onStatus(`正在錄製影片 ${pct}% (請勿切換分頁或關閉螢幕，否則會中斷)…`);
              }
              paintAt(elapsed);
              requestCanvasFrame(streamForFrames);
            };

            resources.worker.onmessage = () => {
              paintElapsed();
            };
            resources.worker.postMessage('start');
            // Immediate first paint after audio starts (don't wait for first interval)
            paintElapsed();

            setTimeout(() => {
              try {
                resources.worker?.postMessage('stop');
              } catch {
                /* ignore */
              }
              paintAt(Math.max(0, totalDuration - 0.01));
              requestCanvasFrame(streamForFrames);
              setTimeout(() => {
                try {
                  if (rec.state === 'recording' || rec.state === 'paused') {
                    try {
                      rec.requestData();
                    } catch {
                      /* ignore */
                    }
                    rec.stop();
                  } else if (!settled) {
                    finish();
                  }
                } catch (e) {
                  finish(e instanceof Error ? e : new Error(String(e)));
                }
              }, 150);
              // 1000ms timeslice needs a little extra tail so the last cluster flushes
            }, totalDuration * 1000 + 500);
          }).catch(err => {
            finish(err instanceof Error ? err : new Error(String(err)));
          });
        };

        try {
          // Record in a single chunk to prevent Cluster timestamp corruption.
          // Using timeslice with canvas capture streams often causes players to stop early.
          rec.start();
        } catch (e) {
          finish(e instanceof Error ? e : new Error(String(e)));
        }

        setTimeout(() => {
          if (!settled && rec.state === 'inactive') {
            finish(new Error('無法開始錄製，請再試一次'));
          }
        }, 4000);
      });

      await sleep(80);

      // ── 4. Stop audio tracks from this run ─────────────────────
      stopTracks(destination.stream, ['audio']);
      if (mixedStream) {
        for (const t of mixedStream.getAudioTracks()) {
          try {
            t.stop();
          } catch {
            /* ignore */
          }
        }
      }
      // Always tear down this run's canvas stream (fresh next time)
      stopTracks(canvasStream, ['video']);
      canvasStream = null;

      // ── 5. Fix WebM duration & optionally convert ──────────────
      if (chunks.length === 0) {
        throw new Error('錄製結果為空，請再試一次');
      }

      let blob = new Blob(chunks, { type: rec.mimeType || mimeType });
      if (blob.size < 1024) {
        throw new Error('錄製檔案過小（可能無影格），請重新整理後再試');
      }

      // Note: We deliberately skip fixWebmDuration — it often corrupts
      // single-chunk WebM (early truncation). WebM may show duration 0 but
      // plays fully; MP4 conversion rewrites duration headers correctly.

      if (format === 'mp4' && (currentExt === 'webm' || blob.type.includes('webm'))) {
        onStatus('正在轉換為 MP4…');
        try {
          const mp4 = await fetchConvert(blob);
          if (mp4 && mp4.size > 512) {
            blob = mp4;
            currentExt = 'mp4';
          } else {
            onStatus('遠端無 FFmpeg，已輸出 WebM（瀏覽器可直接播放下載）');
            currentExt = 'webm';
          }
        } catch (e) {
          console.warn('MP4 conversion failed:', e);
          onStatus('MP4 轉換失敗，保留 WebM 格式。');
          currentExt = 'webm';
        }
      }

      return { blob, ext: currentExt, duration: totalDuration };
    } finally {
      if (resources.timer) clearTimeout(resources.timer);
      try {
        resources.worker?.terminate();
      } catch {
        /* ignore */
      }
      if (resources.workerUrl) URL.revokeObjectURL(resources.workerUrl);

      if (canvasStream) {
        stopTracks(canvasStream);
      }

      if (audioContext) {
        try {
          await audioContext.close();
        } catch {
          /* already closed */
        }
      }

      busyRef.current = false;
    }
  }, [drawFrame, onStatus]);

  const abort = useCallback(() => {
    abortRef.current = true;
  }, []);

  return { record, abort };
}
