import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function buildContentDisposition(filename: string) {
  const asciiFallback = filename.replace(/[^\x20-\x7E]+/g, '_').replace(/"/g, '');
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${asciiFallback || 'download'}"; filename*=UTF-8''${encoded}`;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url) {
      return NextResponse.json({ error: 'Missing URL parameter' }, { status: 400 });
    }

    // Parse Appwrite config from query params to add to headers if needed
    const apiKey = searchParams.get('_key');

    const range = request.headers.get('range');
    const fetchHeaders: Record<string, string> = {};

    if (range) {
      fetchHeaders['range'] = range;
    }

    if (apiKey && apiKey !== 'undefined' && apiKey !== 'null') {
      fetchHeaders['x-appwrite-key'] = apiKey;
    }

    // Forward some common browser headers to be more transparent
    const userAgent = request.headers.get('user-agent');
    if (userAgent) fetchHeaders['user-agent'] = userAgent;
    if (/(\.|^)hdslb\.com$/i.test(new URL(url).hostname) || /(\.|^)biliimg\.com$/i.test(new URL(url).hostname)) {
      fetchHeaders['referer'] = 'https://www.bilibili.com/';
      fetchHeaders['user-agent'] =
        userAgent ||
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';
    }

    const response = await fetch(url, {
      headers: fetchHeaders,
      cache: 'no-store',
      // In Node.js environment, we might need to handle redirects manually if fetch doesn't follow them well
      redirect: 'follow',
    });

    // Check if the request was successful (including partial content)
    if (response.status >= 400) {
      console.error('Media proxy fetch failed:', response.status, response.statusText, 'URL:', url);

      // If it's an auth error and we sent a key, try again without the key (fallback for public files)
      if ((response.status === 401 || response.status === 403) && fetchHeaders['x-appwrite-key']) {
        const retryHeaders = { ...fetchHeaders };
        delete retryHeaders['x-appwrite-key'];

        // Ensure URL has project parameter for public access
        let publicUrl = url;
        if (url.includes('/storage/buckets/') && !url.includes('project=')) {
          const projectId = searchParams.get('_project') ||
            request.headers.get('x-appwrite-project');
          if (projectId) {
            const separator = url.includes('?') ? '&' : '?';
            publicUrl = `${url}${separator}project=${projectId}`;
          }
        }

        const retryResponse = await fetch(publicUrl, { headers: retryHeaders, cache: 'no-store', redirect: 'follow' });
        if (retryResponse.status < 400) {
          return createProxiedResponse(retryResponse, publicUrl, request);
        }
      }

      return new NextResponse(`Media fetch failed with status ${response.status}`, { status: response.status });
    }

    return createProxiedResponse(response, url, request);

  } catch (error) {
    console.error('Media proxy error:', error);
    return NextResponse.json({ error: 'Failed to proxy media' }, { status: 500 });
  }
}

export async function HEAD(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url) {
      return NextResponse.json({ error: 'Missing URL parameter' }, { status: 400 });
    }

    // Parse Appwrite config from query params to add to headers if needed
    const apiKey = searchParams.get('_key');

    const fetchHeaders: Record<string, string> = {};

    if (apiKey && apiKey !== 'undefined' && apiKey !== 'null') {
      fetchHeaders['x-appwrite-key'] = apiKey;
    }

    // Forward some common browser headers to be more transparent
    const userAgent = request.headers.get('user-agent');
    if (userAgent) fetchHeaders['user-agent'] = userAgent;
    if (/(\.|^)hdslb\.com$/i.test(new URL(url).hostname) || /(\.|^)biliimg\.com$/i.test(new URL(url).hostname)) {
      fetchHeaders['referer'] = 'https://www.bilibili.com/';
      fetchHeaders['user-agent'] =
        userAgent ||
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';
    }

    const response = await fetch(url, {
      method: 'HEAD',
      headers: fetchHeaders,
      cache: 'no-store',
      redirect: 'follow',
    });

    // Return the response with same status code and headers
    const responseHeaders = new Headers();

    // Copy essential headers
    const headersToCopy = [
      'content-type',
      'content-length',
      'accept-ranges',
      'last-modified',
      'etag',
      'cache-control',
      'content-disposition'
    ];

    headersToCopy.forEach(header => {
      const value = response.headers.get(header);
      if (value) {
        responseHeaders.set(header, value);
      }
    });

    return new NextResponse(null, {
      status: response.status,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error('Media proxy HEAD error:', error);
    return NextResponse.json({ error: 'Failed to proxy media HEAD request' }, { status: 500 });
  }
}

function createProxiedResponse(response: Response, url: string, request: NextRequest) {
  const responseHeaders = new Headers();
  const searchParams = new URL(request.url).searchParams;

  // Essential headers for streaming and playback
  const headersToCopy = [
    'content-type',
    'content-length',
    'content-range',
    'accept-ranges',
    'cache-control',
  ];

  headersToCopy.forEach(header => {
    const value = response.headers.get(header);
    if (value) {
      responseHeaders.set(header, value);
    }
  });

  // Ensure Accept-Ranges is set to bytes to enable seeking
  if (!responseHeaders.has('accept-ranges')) {
    responseHeaders.set('accept-ranges', 'bytes');
  }

  if (searchParams.get('download') === '1') {
    const filename = searchParams.get('filename') || url.split('?')[0].split('/').pop() || 'download';
    responseHeaders.set('content-disposition', buildContentDisposition(filename));
  } else {
    responseHeaders.set('content-disposition', 'inline');
  }

  // Add CORS headers to allow PDF preview and other cross-origin usage
  responseHeaders.set('access-control-allow-origin', '*');
  responseHeaders.set('access-control-allow-methods', 'GET, HEAD, OPTIONS');
  responseHeaders.set('access-control-allow-headers', 'range, content-type');
  responseHeaders.set('access-control-expose-headers', 'content-range, accept-ranges, content-length');

  // Detect and fix content types based on file extension if they are generic
  let contentType = responseHeaders.get('content-type');
  if (!contentType || contentType === 'application/octet-stream') {
    const ext = url.split('?')[0].split('.').pop()?.toLowerCase();
    if (ext === 'm4a') contentType = 'audio/mp4';
    else if (ext === 'mp3') contentType = 'audio/mpeg';
    else if (ext === 'mp4') contentType = 'video/mp4';
    else if (ext === 'webm') contentType = 'video/webm';
    else if (ext === 'ogg') contentType = 'audio/ogg';
    else if (ext === 'wav') contentType = 'audio/wav';
    else if (ext === 'flac') contentType = 'audio/flac';
    else if (ext === 'aac') contentType = 'audio/aac';
    else if (ext === 'pdf') contentType = 'application/pdf';

    if (contentType) responseHeaders.set('content-type', contentType);
  }

  // 為圖片設定快取標頭（1小時），減少重複載入
  const finalContentType = responseHeaders.get('content-type') || '';
  if (finalContentType.startsWith('image/')) {
    responseHeaders.set('cache-control', 'public, max-age=3600, stale-while-revalidate=86400');
  }

  // Use the standard Response constructor which works better for streaming in some cases
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}
