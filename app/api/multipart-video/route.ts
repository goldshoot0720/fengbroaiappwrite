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

function isVideoPartManifest(value: unknown): value is VideoPartManifest {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<VideoPartManifest>;
  return candidate.type === 'fengbro-video-manifest' && Array.isArray(candidate.parts);
}

function getAuthHeaders(searchParams: URLSearchParams) {
  const headers: Record<string, string> = {};
  const apiKey = searchParams.get('_key');
  if (apiKey && apiKey !== 'undefined' && apiKey !== 'null') {
    headers['x-appwrite-key'] = apiKey;
  }
  return headers;
}

function ensureProjectParam(url: string, searchParams: URLSearchParams) {
  if (url.includes('project=')) {
    return url;
  }

  const projectId = searchParams.get('_project');
  if (!projectId || projectId === 'undefined' || projectId === 'null') {
    return url;
  }

  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}project=${projectId}`;
}

async function fetchWithAuthFallback(
  url: string,
  init: RequestInit,
  searchParams: URLSearchParams
) {
  const authHeaders = getAuthHeaders(searchParams);
  const headers = {
    ...(init.headers || {}),
    ...authHeaders,
  };

  let response = await fetch(url, {
    ...init,
    headers,
    cache: 'no-store',
    redirect: 'follow',
  });

  if ((response.status === 401 || response.status === 403) && authHeaders['x-appwrite-key']) {
    const publicUrl = ensureProjectParam(url, searchParams);
    response = await fetch(publicUrl, {
      ...init,
      headers: init.headers,
      cache: 'no-store',
      redirect: 'follow',
    });
  }

  return response;
}

async function fetchManifest(searchParams: URLSearchParams): Promise<VideoPartManifest> {
  const manifestUrl = ensureProjectParam(searchParams.get('manifestUrl') || '', searchParams);
  if (!manifestUrl) {
    throw new Error('Missing manifestUrl parameter');
  }

  const response = await fetchWithAuthFallback(manifestUrl, {
    headers: {
      Accept: 'application/json',
    },
  }, searchParams);

  if (!response.ok) {
    throw new Error(`Manifest fetch failed: HTTP ${response.status}`);
  }

  let manifest: unknown;
  try {
    manifest = await response.json();
  } catch {
    throw new Error('Manifest JSON parse failed');
  }
  if (!isVideoPartManifest(manifest)) {
    throw new Error('Invalid multipart video manifest');
  }

  return manifest;
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
  let start = rawStart ? Number.parseInt(rawStart, 10) : 0;
  let end = rawEnd ? Number.parseInt(rawEnd, 10) : totalSize - 1;

  // Support suffix-byte-range-spec, e.g. "bytes=-65536"
  if (!rawStart && rawEnd) {
    const suffixLength = Number.parseInt(rawEnd, 10);
    if (Number.isNaN(suffixLength) || suffixLength <= 0) {
      throw new Error('Invalid range request');
    }
    start = Math.max(totalSize - suffixLength, 0);
    end = totalSize - 1;
  }

  if (Number.isNaN(start) || Number.isNaN(end) || start < 0 || end < start || end >= totalSize) {
    throw new Error('Invalid range request');
  }

  return { start, end, partial: true };
}

async function fetchPartBytes(partUrl: string, start: number, end: number, searchParams: URLSearchParams) {
  const response = await fetchWithAuthFallback(ensureProjectParam(partUrl, searchParams), {}, searchParams);

  if (!response.ok) {
    throw new Error(`Part fetch failed: HTTP ${response.status} for range ${start}-${end}`);
  }

  const fullBytes = new Uint8Array(await response.arrayBuffer());

  if (start < 0 || end < start || end >= fullBytes.byteLength) {
    throw new Error(`Part slice out of bounds for range ${start}-${end} within ${fullBytes.byteLength} bytes`);
  }

  return fullBytes.slice(start, end + 1);
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
    console.error('[multipart-video][HEAD]', error);
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
    const { start, end, partial } = parseRangeHeader(request.headers.get('range'), manifest.originalSize);

    const partsToRead: Array<{ url: string; start: number; end: number }> = [];
    let currentOffset = 0;

    for (const part of manifest.parts) {
      const partStart = currentOffset;
      const partEnd = currentOffset + part.size - 1;

      if (end < partStart || start > partEnd) {
        currentOffset += part.size;
        continue;
      }

      const fetchStart = Math.max(0, start - partStart);
      const fetchEnd = Math.min(part.size - 1, end - partStart);
      partsToRead.push({ url: part.url, start: fetchStart, end: fetchEnd });
      currentOffset += part.size;
    }

    const contentLength = end - start + 1;
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for (const [index, part] of partsToRead.entries()) {
            const bytes = await fetchPartBytes(part.url, part.start, part.end, searchParams);
            if (!bytes.byteLength) {
              throw new Error(`Part response body is empty at index ${index}`);
            }
            controller.enqueue(bytes);
          }
          controller.close();
        } catch (error) {
          console.error('[multipart-video][stream]', error);
          controller.error(error instanceof Error ? error : new Error('Failed to stream multipart video'));
        }
      }
    });

    const contentRange = partial ? `bytes ${start}-${end}/${manifest.originalSize}` : undefined;
    return new NextResponse(stream, {
      status: partial ? 206 : 200,
      headers: buildHeaders(manifest, contentLength, contentRange),
    });
  } catch (error) {
    console.error('[multipart-video][GET]', {
      error: error instanceof Error ? error.message : error,
      range: request.headers.get('range'),
      manifestUrl: new URL(request.url).searchParams.get('manifestUrl'),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to stream multipart video' },
      { status: 500 }
    );
  }
}
