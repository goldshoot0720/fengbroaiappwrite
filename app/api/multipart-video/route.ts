import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface VideoPartManifestEntry {
  index: number;
  name: string;
  fileId: string;
  url: string;
  size: number;
}

interface VideoPartManifest {
  version: 1;
  type: 'fengbro-video-manifest';
  originalName: string;
  originalType: string;
  originalExtension: string;
  originalSize: number;
  partSize: number;
  parts: VideoPartManifestEntry[];
}

function getAuthHeaders(searchParams: URLSearchParams) {
  const headers: Record<string, string> = {};
  const apiKey = searchParams.get('_key');
  if (apiKey && apiKey !== 'undefined' && apiKey !== 'null') {
    headers['x-appwrite-key'] = apiKey;
  }
  return headers;
}

async function fetchManifest(searchParams: URLSearchParams): Promise<VideoPartManifest> {
  const manifestUrl = searchParams.get('manifestUrl');
  if (!manifestUrl) {
    throw new Error('Missing manifestUrl parameter');
  }

  const response = await fetch(manifestUrl, {
    headers: {
      Accept: 'application/json',
      ...getAuthHeaders(searchParams),
    },
    cache: 'no-store',
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`Manifest fetch failed: HTTP ${response.status}`);
  }

  const manifest = await response.json();
  if (manifest?.type !== 'fengbro-video-manifest' || !Array.isArray(manifest?.parts)) {
    throw new Error('Invalid multipart video manifest');
  }

  return manifest as VideoPartManifest;
}

function buildHeaders(manifest: VideoPartManifest, contentLength: number, contentRange?: string) {
  const headers = new Headers();
  headers.set('content-type', manifest.originalType || 'video/mp4');
  headers.set('accept-ranges', 'bytes');
  headers.set('cache-control', 'no-store');
  headers.set('content-length', String(contentLength));
  if (contentRange) {
    headers.set('content-range', contentRange);
  }
  return headers;
}

function parseRangeHeader(rangeHeader: string | null, totalSize: number) {
  if (!rangeHeader?.startsWith('bytes=')) {
    return { start: 0, end: totalSize - 1, partial: false };
  }

  const [rawStart, rawEnd] = rangeHeader.replace('bytes=', '').split('-');
  const start = rawStart ? Number.parseInt(rawStart, 10) : 0;
  const end = rawEnd ? Number.parseInt(rawEnd, 10) : totalSize - 1;

  if (Number.isNaN(start) || Number.isNaN(end) || start < 0 || end < start || end >= totalSize) {
    throw new Error('Invalid range request');
  }

  return { start, end, partial: true };
}

async function fetchPartBytes(partUrl: string, start: number, end: number, authHeaders: Record<string, string>) {
  const response = await fetch(partUrl, {
    headers: {
      ...authHeaders,
      range: `bytes=${start}-${end}`,
    },
    cache: 'no-store',
    redirect: 'follow',
  });

  if (!response.ok && response.status !== 206) {
    throw new Error(`Part fetch failed: HTTP ${response.status}`);
  }

  return new Uint8Array(await response.arrayBuffer());
}

export async function HEAD(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const manifest = await fetchManifest(searchParams);
    return new NextResponse(null, {
      status: 200,
      headers: buildHeaders(manifest, manifest.originalSize),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load multipart video metadata' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const manifest = await fetchManifest(searchParams);
    const authHeaders = getAuthHeaders(searchParams);
    const { start, end, partial } = parseRangeHeader(request.headers.get('range'), manifest.originalSize);

    let currentOffset = 0;
    const chunks: Uint8Array[] = [];

    for (const part of manifest.parts) {
      const partStart = currentOffset;
      const partEnd = currentOffset + part.size - 1;

      if (end < partStart || start > partEnd) {
        currentOffset += part.size;
        continue;
      }

      const fetchStart = Math.max(0, start - partStart);
      const fetchEnd = Math.min(part.size - 1, end - partStart);
      chunks.push(await fetchPartBytes(part.url, fetchStart, fetchEnd, authHeaders));
      currentOffset += part.size;
    }

    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    const body = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }

    const contentRange = partial ? `bytes ${start}-${end}/${manifest.originalSize}` : undefined;
    return new NextResponse(body, {
      status: partial ? 206 : 200,
      headers: buildHeaders(manifest, body.byteLength, contentRange),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to stream multipart video' },
      { status: 500 }
    );
  }
}
