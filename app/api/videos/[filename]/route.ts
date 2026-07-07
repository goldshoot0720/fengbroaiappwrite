import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    
    // 安全檢查：確保文件名不包含路徑遍歷
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return NextResponse.json({ error: '無效的文件名' }, { status: 400 });
    }

    // 構建文件路徑
    const filePath = path.join(process.cwd(), 'public', 'videos', filename);
    
    try {
      // 檢查文件是否存在
      await fs.access(filePath);
      
      // 讀取文件
      const fileBuffer = await fs.readFile(filePath);
      
      // 設置適當的 Content-Type
      const contentType = getContentType(filename);
      
      // 獲取文件大小
      const stats = await fs.stat(filePath);
      const fileSize = stats.size;
      
      // 處理 Range 請求（用於影片流式播放）
      const range = request.headers.get('range');
      
      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        
        const chunk = fileBuffer.slice(start, end + 1);
        
        return new NextResponse(chunk, {
          status: 206,
          headers: {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize.toString(),
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=31536000', // 快取一年
          },
        });
      }
      
      // 如果沒有 Range 請求，返回完整文件
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': contentType,
          'Content-Length': fileSize.toString(),
          'Cache-Control': 'public, max-age=31536000', // 快取一年
          'Accept-Ranges': 'bytes',
        },
      });
      
    } catch (fileError) {
      // 如果文件不存在，返回 404
      return NextResponse.json({ error: '文件未找到' }, { status: 404 });
    }
    
  } catch (error) {
    console.error('影片服務錯誤:', error);
    return NextResponse.json({ error: '服務器錯誤' }, { status: 500 });
  }
}

function getContentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  
  switch (ext) {
    case '.mp4':
      return 'video/mp4';
    case '.webm':
      return 'video/webm';
    case '.ogg':
      return 'video/ogg';
    case '.avi':
      return 'video/x-msvideo';
    case '.mov':
      return 'video/quicktime';
    default:
      return 'video/mp4'; // 默認為 mp4
  }
}