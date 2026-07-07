import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export async function GET() {
  try {
    const imagesDir = path.join(process.cwd(), "public", "images");
    
    // 檢查 images 資料夾是否存在
    try {
      await fs.access(imagesDir);
    } catch (error) {
      // 如果資料夾不存在，返回空結果
      return NextResponse.json({
        success: true,
        count: 0,
        images: []
      });
    }
    
    const files = await fs.readdir(imagesDir);
    
    // 過濾出圖片文件 - 只包含 JPG/JPEG/PNG
    const imageExtensions = ['.jpg', '.jpeg', '.png'];
    const imageFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return imageExtensions.includes(ext);
    });

    // 獲取文件詳細信息
    const imagesWithDetails = await Promise.all(
      imageFiles.map(async (file) => {
        try {
          const filePath = path.join(imagesDir, file);
          const stats = await fs.stat(filePath);
          
          return {
            name: file,
            path: `/images/${file}`,
            size: stats.size,
            modified: stats.mtime.toISOString(),
            extension: path.extname(file).toLowerCase()
          };
        } catch (error) {
          console.error(`Error getting stats for ${file}:`, error);
          return {
            name: file,
            path: `/images/${file}`,
            size: 0,
            modified: new Date().toISOString(),
            extension: path.extname(file).toLowerCase()
          };
        }
      })
    );

    // 按修改時間排序（最新的在前）
    imagesWithDetails.sort((a, b) => new Date(b.modified) - new Date(a.modified));

    return NextResponse.json({
      success: true,
      count: imagesWithDetails.length,
      images: imagesWithDetails
    });
  } catch (error) {
    console.error("Error reading images:", error);
    return NextResponse.json(
      { success: false, error: "Failed to read images" },
      { status: 500 }
    );
  }
}