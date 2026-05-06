import { NextResponse } from "next/server";
import { STORAGE_UPLOAD_LIMIT_BYTES } from "../_lib/storageQuota";

const sdk = require('node-appwrite');

export const dynamic = 'force-dynamic';

// Helper function to extract file ID from Appwrite URL or return as-is
// Returns null for external URLs (not Appwrite Storage)
function extractFileId(value) {
  if (!value) return null;
  
  // Check if it's an Appwrite Storage URL
  if (value.includes('/files/')) {
    const match = value.match(/\/files\/([^\/\?]+)/);
    if (match) return match[1];
  }
  
  // Filter out external URLs (http://, https://, www., etc.)
  if (value.startsWith('http://') || 
      value.startsWith('https://') || 
      value.startsWith('www.') ||
      value.includes('://')) {
    console.log(`    ⚠️ 跳過外部網址: ${value.substring(0, 50)}...`);
    return null; // Skip external URLs
  }
  
  // Otherwise return as-is (already a file ID)
  return value;
}

// Helper function to get collection ID by name
async function getCollectionId(databases, databaseId, name) {
  try {
    const allCollections = await databases.listCollections(databaseId);
    const col = allCollections.collections.find(c => c.name === name);
    if (!col) return null; // Return null if not found instead of throwing
    return col.$id;
  } catch (error) {
    console.error(`Error getting collection ID for ${name}:`, error.message);
    return null;
  }
}

function createAppwrite(config) {
  const endpoint = config?.endpoint || process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
  const projectId = config?.projectId || process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
  const apiKey = config?.apiKey || process.env.APPWRITE_API_KEY || process.env.NEXT_PUBLIC_APPWRITE_API_KEY;
  const bucketId = config?.bucketId || process.env.APPWRITE_BUCKET_ID || process.env.NEXT_PUBLIC_APPWRITE_BUCKET_ID;
  const databaseId = config?.databaseId || process.env.APPWRITE_DATABASE_ID;

  if (!endpoint || !projectId || !apiKey || !bucketId) {
    throw new Error("Appwrite configuration is missing");
  }

  const client = new sdk.Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setKey(apiKey);

  const storage = new sdk.Storage(client);
  const databases = new sdk.Databases(client);

  return { storage, databases, bucketId, databaseId, endpoint, projectId, apiKey };
}

function normalizeEndpoint(endpoint) {
  if (!endpoint) return '';
  return endpoint.endsWith('/v1') ? endpoint : `${endpoint.replace(/\/$/, '')}/v1`;
}

function isMultipartVideoRecord(doc, field) {
  return field === 'file' && typeof doc?.filetype === 'string' && doc.filetype.endsWith('+part');
}

async function fetchMultipartManifestFileIds(storageConfig, bucketId, manifestFileId) {
  try {
    const endpoint = normalizeEndpoint(storageConfig.endpoint);
    const url = `${endpoint}/storage/buckets/${bucketId}/files/${manifestFileId}/download?project=${storageConfig.projectId}`;
    const response = await fetch(url, {
      headers: {
        'x-appwrite-key': storageConfig.apiKey,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      console.warn(`    ⚠️ 讀取 multipart manifest 失敗: ${manifestFileId} HTTP ${response.status}`);
      return [];
    }

    const manifest = await response.json();
    if (!manifest || manifest.type !== 'fengbro-video-manifest' || !Array.isArray(manifest.parts)) {
      return [];
    }

    return manifest.parts
      .map((part) => extractFileId(part.fileId || part.url))
      .filter(Boolean);
  } catch (error) {
    console.warn(`    ⚠️ 解析 multipart manifest 失敗: ${manifestFileId}`, error?.message || error);
    return [];
  }
}

function classifyStorageFile(file) {
  const mimeType = file.mimeType || '';
  const fileName = (file.name || '').toLowerCase();

  if (mimeType.startsWith('image/')) return 'images';
  if (mimeType.startsWith('video/')) return 'videos';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (fileName.includes('.manifest.json') || fileName.includes('.part')) return 'videos';

  if (
    mimeType === 'application/pdf' ||
    mimeType === 'text/plain' ||
    mimeType === 'text/markdown' ||
    mimeType === 'application/json' ||
    mimeType.includes('document') ||
    mimeType.includes('spreadsheet')
  ) {
    return 'documents';
  }

  return 'other';
}

// Helper function to get all files from storage
async function getAllStorageFiles(storage, bucketId) {
  let allFiles = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const response = await storage.listFiles(bucketId, [
      sdk.Query.limit(limit),
      sdk.Query.offset(offset)
    ]);

    allFiles = allFiles.concat(response.files);

    if (response.files.length < limit) {
      break;
    }

    offset += limit;
  }

  return allFiles;
}

// Helper function to get all referenced file IDs from database
async function getAllReferencedFileIds(databases, databaseId, storageConfig, bucketId) {
  // 所有可能使用檔案的集合與對應欄位 (使用 table name)
  // bank, commonaccount, subscription 不會使用到 storage 檔案
  const collectionFields = {
    'article': ['file1', 'file2', 'file3'],  // 筆記 - file1, file2, file3
    'food': ['photo'],                        // 食物 - photo
    'music': ['file', 'cover'],               // 音樂 - file, cover
    'podcast': ['file'],                      // 播客 - file
    'commondocument': ['file'],               // 文件 - file
    'routine': ['photo'],                     // 行程 - photo
    'video': ['file', 'cover'],               // 影片 - file, cover
    'image': ['file']                         // 圖片 - file
  };
  
  const fileIdSet = new Set();
  const collectionCounts = {}; // Store document count per collection
  console.log(`  📋 掃描 ${Object.keys(collectionFields).length} 個集合...`);

  for (const [collectionName, fields] of Object.entries(collectionFields)) {
    try {
      // 使用 table name 查詢 collection ID
      const collectionId = await getCollectionId(databases, databaseId, collectionName);
      
      if (!collectionId) {
        console.log(`    ⚠️ 跳過 ${collectionName}: Collection 不存在`);
        collectionCounts[collectionName] = 0; // Set to 0 if collection doesn't exist
        continue;
      }

      let offset = 0;
      const limit = 100;
      let collectionTotal = 0;
      let filesFound = 0;

      console.log(`\n  📂 ${collectionName} [${collectionId}] (欄位: ${fields.join(', ')})`);

      while (true) {
        const response = await databases.listDocuments(databaseId, collectionId, [
          sdk.Query.limit(limit),
          sdk.Query.offset(offset)
        ]);

        collectionTotal += response.documents.length;

        for (const doc of response.documents) {
          // Extract file IDs from collection-specific fields
          for (const field of fields) {
            if (doc[field]) {
              // Extract file ID from URL or use value as-is
              const fileId = extractFileId(doc[field]);
              if (fileId) {
                fileIdSet.add(fileId);
                filesFound++;
                console.log(`    ✅ ${doc.$id}.${field} = ${fileId}`);

                if (collectionName === 'video' && isMultipartVideoRecord(doc, field)) {
                  const partIds = await fetchMultipartManifestFileIds(storageConfig, bucketId, fileId);
                  partIds.forEach((partId) => fileIdSet.add(partId));
                  if (partIds.length > 0) {
                    console.log(`    🎬 ${doc.$id} multipart parts = ${partIds.length}`);
                  }
                }
              }
            }
          }
        }

        if (response.documents.length < limit) {
          break;
        }

        offset += limit;
      }

      collectionCounts[collectionName] = collectionTotal; // Store total documents
      console.log(`    📊 ${collectionName}: ${collectionTotal} 筆資料, ${filesFound} 個檔案引用`);
    } catch (error) {
      console.error(`    ❌ 錯誤 ${collectionName}:`, error.message);
      collectionCounts[collectionName] = 0; // Set to 0 on error
    }
  }

  console.log(`\n  🎯 總計引用檔案: ${fileIdSet.size} 個`);
  return { fileIdSet, collectionCounts };
}

// Count orphaned files
async function countOrphanedFiles(appwriteConfig) {
  try {
    const { storage, databases, bucketId, databaseId, endpoint, projectId, apiKey } = createAppwrite(appwriteConfig);

    console.log('\n=== 開始 Appwrite Storage 掃描 ===');
    
    // Get all storage files
    console.log('\n步驟 1: 獲取所有 Storage 檔案...');
    const allFiles = await getAllStorageFiles(storage, bucketId);
    console.log(`✅ 找到 ${allFiles.length} 個 Storage 檔案`);

    // Get all referenced file IDs
    console.log('\n步驟 2: 掃描資料庫引用...');
    const { fileIdSet: referencedIds, collectionCounts } = await getAllReferencedFileIds(
      databases,
      databaseId,
      { endpoint, projectId, apiKey },
      bucketId
    );
    console.log(`✅ 資料庫已引用 ${referencedIds.size} 個檔案`);
    
    // Validate: referenced should not exceed total files
    if (referencedIds.size > allFiles.length) {
      console.warn(`⚠️ 異常：引用數 (${referencedIds.size}) > 總檔案數 (${allFiles.length})`);
      console.warn('可能原因：資料庫中有引用不存在的檔案 ID');
      
      // Find IDs that are referenced but don't exist in storage
      const storageFileIds = new Set(allFiles.map(f => f.$id));
      const phantomIds = Array.from(referencedIds).filter(id => !storageFileIds.has(id));
      console.log(`👻 幻影 ID 數量: ${phantomIds.length}`);
      if (phantomIds.length > 0 && phantomIds.length <= 10) {
        console.log(`幻影 ID 範例: ${phantomIds.slice(0, 10).join(', ')}`);
      }
    }

    // Find orphaned files
    console.log('\n步驟 3: 逐筆比對檔案...');
    console.log(`  🔍 第一個 Storage 檔案 ID: ${allFiles[0]?.$id}`);
    console.log(`  🔍 第一個引用 ID: ${Array.from(referencedIds)[0]}`);
    
    const orphanedFiles = [];
    const referencedFiles = [];
    
    allFiles.forEach((file, index) => {
      const isReferenced = referencedIds.has(file.$id);
      const status = isReferenced ? '✅ 已引用' : '❌ 多餘';
      
      console.log(`  [${index + 1}/${allFiles.length}] ${status} - ${file.name} (${file.$id})`);
      
      if (isReferenced) {
        referencedFiles.push(file);
      } else {
        orphanedFiles.push(file);
      }
    });

    // Categorize orphaned files by type
    console.log('\n步驟 4: 分類多餘檔案...');
    const orphanedByType = {
      images: 0,
      videos: 0,
      music: 0,
      documents: 0,
      podcasts: 0,
      other: 0
    };

    orphanedFiles.forEach(file => {
      const kind = classifyStorageFile(file);
      if (kind === 'images') {
        orphanedByType.images++;
        console.log(`  🖼️ 圖片: ${file.name}`);
      } else if (kind === 'videos') {
        orphanedByType.videos++;
        console.log(`  🎥 影片: ${file.name}`);
      } else if (kind === 'audio') {
        orphanedByType.music++;
        orphanedByType.podcasts++;
        console.log(`  🎵 音訊: ${file.name}`);
      } else if (kind === 'documents') {
        orphanedByType.documents++;
        console.log(`  📄 文件: ${file.name}`);
      } else {
        orphanedByType.other++;
        console.log(`  ❓ 其他: ${file.name}`);
      }
    });

    console.log('\n=== 掃描完成 ===');
    console.log(`總計: ${allFiles.length} 個檔案`);
    console.log(`已引用: ${referencedFiles.length} 個`);
    console.log(`多餘: ${orphanedFiles.length} 個`);

    return NextResponse.json({
      success: true,
      totalFiles: allFiles.length,
      referencedFiles: referencedIds.size,
      orphanedFiles: orphanedFiles.length,
      orphanedByType,
      collectionCounts, // Include document counts per collection
      orphanedFileIds: orphanedFiles.map(f => f.$id)
    });
  } catch (error) {
    console.error('Count orphaned files error:', error);
    return NextResponse.json({
      error: error.message || '統計失敗',
      totalFiles: 0,
      referencedFiles: 0,
      orphanedFiles: 0,
      orphanedByType: {
        images: 0,
        videos: 0,
        music: 0,
        documents: 0,
        podcasts: 0
      }
    }, { status: 500 });
  }
}

// POST handler for deleting orphaned files
export async function POST(request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action !== 'delete') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const appwriteConfig = {
      endpoint: searchParams.get('_endpoint'),
      projectId: searchParams.get('_project'),
      databaseId: searchParams.get('_database'),
      apiKey: searchParams.get('_key'),
      bucketId: searchParams.get('_bucket'),
    };

    const { storage, databases, bucketId, databaseId, endpoint, projectId, apiKey } = createAppwrite(appwriteConfig);

    // Get all storage files
    const allFiles = await getAllStorageFiles(storage, bucketId);

    // Get all referenced file IDs
    const { fileIdSet: referencedIds } = await getAllReferencedFileIds(
      databases,
      databaseId,
      { endpoint, projectId, apiKey },
      bucketId
    );

    // Find orphaned files
    const orphanedFiles = allFiles.filter(file => !referencedIds.has(file.$id));

    // Delete orphaned files
    let deletedCount = 0;
    let failedCount = 0;

    for (const file of orphanedFiles) {
      try {
        await storage.deleteFile(bucketId, file.$id);
        deletedCount++;
      } catch (error) {
        console.error(`Failed to delete file ${file.$id}:`, error.message);
        failedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      deletedCount,
      failedCount,
      totalOrphaned: orphanedFiles.length
    });
  } catch (error) {
    console.error('Delete orphaned files error:', error);
    return NextResponse.json({
      error: error.message || '刪除失敗',
      deletedCount: 0,
      failedCount: 0
    }, { status: 500 });
  }
}

// GET /api/storage-stats - Get storage statistics from Appwrite Storage
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    
    const appwriteConfig = {
      endpoint: searchParams.get('_endpoint'),
      projectId: searchParams.get('_project'),
      databaseId: searchParams.get('_database'),
      apiKey: searchParams.get('_key'),
      bucketId: searchParams.get('_bucket'),
    };

    const { storage, bucketId } = createAppwrite(appwriteConfig);

    // If action is 'count', find orphaned files
    if (action === 'count') {
      return await countOrphanedFiles(appwriteConfig);
    }

    // Get all files from the bucket
    let allFiles = [];
    let offset = 0;
    const limit = 100; // Max items per request

    while (true) {
      const response = await storage.listFiles(bucketId, [
        sdk.Query.limit(limit),
        sdk.Query.offset(offset)
      ]);

      allFiles = allFiles.concat(response.files);

      if (response.files.length < limit) {
        break; // No more files to fetch
      }

      offset += limit;
    }

    // Calculate statistics by file type
    let imagesSize = 0;
    let videosSize = 0;
    let musicSize = 0;
    let documentsSize = 0;
    let otherSize = 0;
    
    let imagesCount = 0;
    let videosCount = 0;
    let musicCount = 0;
    let documentsCount = 0;
    let otherCount = 0;

    allFiles.forEach(file => {
      const size = file.sizeOriginal || 0;
      const kind = classifyStorageFile(file);

      if (kind === 'images') {
        imagesSize += size;
        imagesCount++;
      } else if (kind === 'videos') {
        videosSize += size;
        videosCount++;
      } else if (kind === 'audio') {
        musicSize += size;
        musicCount++;
      } else if (kind === 'documents') {
        documentsSize += size;
        documentsCount++;
      } else {
        otherSize += size;
        otherCount++;
      }
    });

    const totalSize = imagesSize + videosSize + musicSize + documentsSize + otherSize;
    const totalCount = allFiles.length;

    // Get bucket information (note: bucket details might not include size limit via API)
    // For now, we'll use a default limit or make it configurable
    const storageLimit = STORAGE_UPLOAD_LIMIT_BYTES;
    const usagePercentage = storageLimit > 0 ? (totalSize / storageLimit) * 100 : 0;

    return NextResponse.json({
      success: true,
      stats: {
        totalFiles: totalCount,
        totalSize,
        storageLimit,
        usagePercentage,
        images: {
          count: imagesCount,
          size: imagesSize,
        },
        videos: {
          count: videosCount,
          size: videosSize,
        },
        music: {
          count: musicCount,
          size: musicSize,
        },
        documents: {
          count: documentsCount,
          size: documentsSize,
        },
        other: {
          count: otherCount,
          size: otherSize,
        }
      }
    });

  } catch (err) {
    console.error("GET /api/storage-stats error:", err);
    const errorMessage = err.message || '獲取儲存統計失敗';
    const isBandwidthError = errorMessage.includes('Bandwidth limit') || errorMessage.includes('bandwidth') || errorMessage.includes('exceeded');
    return NextResponse.json({
      error: isBandwidthError
        ? 'Bandwidth limit for your organization has exceeded. Please upgrade to a higher plan or update your budget cap.'
        : errorMessage,
      stats: {
        totalFiles: 0,
        totalSize: 0,
        storageLimit: STORAGE_UPLOAD_LIMIT_BYTES,
        usagePercentage: 0,
        images: { count: 0, size: 0 },
        videos: { count: 0, size: 0 },
        music: { count: 0, size: 0 },
        documents: { count: 0, size: 0 },
        other: { count: 0, size: 0 }
      }
    }, { status: 500 });
  }
}
