import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const GITHUB_REPO = "goldshoot0720/fengbroaiappwrite";
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// 鋒兄關於：網站營運天數，參考 GitHub 儲存庫建立日期。
export async function GET() {
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}`, {
      headers: { Accept: "application/vnd.github+json" },
      // GitHub 公開 repo 資訊變動很慢，快取一天即可。
      next: { revalidate: 86400 },
    });

    if (!res.ok) {
      throw new Error(`GitHub API ${res.status}`);
    }

    const data = await res.json();
    const createdAt = data.created_at;
    if (!createdAt) throw new Error("GitHub 回應缺少 created_at");

    const daysSinceCreated = Math.max(
      0,
      Math.floor((Date.now() - new Date(createdAt).getTime()) / MS_PER_DAY)
    );

    return NextResponse.json({
      repo: GITHUB_REPO,
      createdAt,
      daysSinceCreated,
    }, {
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
    });
  } catch (err) {
    console.error("GET /github-repo-stats error:", err);
    return NextResponse.json(
      { repo: GITHUB_REPO, createdAt: null, daysSinceCreated: null, error: err.message },
      { status: 200 }
    );
  }
}
