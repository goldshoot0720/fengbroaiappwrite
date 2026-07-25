import { NextResponse } from "next/server";
import { fetchLandtopCatalog } from "@/app/api/_lib/landtop";
import { fetchJyesCatalog } from "@/app/api/_lib/jyes";
import { loadLandtopHistories, persistLandtopSnapshots } from "@/app/api/_lib/landtopHistory";

type CompareProduct = {
  id: string;
  brand: string;
  name: string;
  suggestedPrice?: number | null;
  landtopPrice?: number | null;
  landtopPriceLabel?: string | null;
  sourceUrl?: string | null;
  jyesPrice?: number | null;
  jyesPriceLabel?: string | null;
  jyesUrl?: string | null;
  bestPrice?: number | null;
  bestSourceLabel?: string | null;
};

function normalizeCompareName(value: string) {
  return value
    .replace(/\[(.*?)\]/g, "")
    .replace(/[()]/g, " ")
    .replace(/\b(\d{3,4})G\b/gi, "$1GB")
    .replace(/\//g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function hasCapacityVariantInfo(name: string) {
  return /(\d{3,4}GB|\d{3,4}G|\d{1,2}G\s+\d{3,4}GB|\d{1,2}G\/\d{3,4}G)/i.test(name || "");
}

/** "Samsung A17 6G 128GB" / "Samsung A17" → "samsung a17" */
function modelBaseKey(name: string) {
  return (name || "")
    .replace(/\b(\d{1,2})\s*G\s*\/\s*(\d{3,4})\s*G(B)?\b/gi, " ")
    .replace(/\b(\d{1,2})\s*G\s+(\d{3,4})\s*GB\b/gi, " ")
    .replace(/\b\d{3,4}\s*GB?\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Drop bare "Samsung A17" when "Samsung A17 6G 128GB" / "8G 128GB" already exist. */
function dropShellProductsWhenVariantsExist(products: CompareProduct[]) {
  const variantBases = new Set(
    products.filter((p) => hasCapacityVariantInfo(p.name || "")).map((p) => modelBaseKey(p.name || ""))
  );
  if (variantBases.size === 0) return products;
  return products.filter((product) => {
    if (hasCapacityVariantInfo(product.name || "")) return true;
    const base = modelBaseKey(product.name || "");
    return !base || !variantBases.has(base);
  });
}

function mergeProducts(landtopProducts: CompareProduct[], jyesProducts: CompareProduct[]) {
  const jyesByName = new Map(
    jyesProducts.map((product) => [normalizeCompareName(product.name || ""), product])
  );

  const merged: CompareProduct[] = landtopProducts.map((product) => {
    const jyesMatch = jyesByName.get(normalizeCompareName(product.name || ""));
    const landtopPrice = typeof product.landtopPrice === "number" ? product.landtopPrice : null;
    const jyesPrice = jyesMatch && typeof jyesMatch.jyesPrice === "number" ? jyesMatch.jyesPrice : null;
    const bestPrice =
      [landtopPrice, jyesPrice].filter((value): value is number => typeof value === "number").sort((a, b) => a - b)[0] ??
      null;

    return {
      ...product,
      jyesPrice,
      jyesPriceLabel: jyesPrice == null ? "門市破盤價" : `NT$ ${jyesPrice.toLocaleString("zh-TW")}`,
      jyesUrl: jyesMatch?.jyesUrl || null,
      bestPrice,
      bestSourceLabel: bestPrice == null ? null : bestPrice === landtopPrice ? "地標網通" : "傑昇通信",
    };
  });

  const knownKeys = new Set(merged.map((product) => normalizeCompareName(product.name || "")));
  const jyesOnly: CompareProduct[] = jyesProducts
    .filter((product) => !knownKeys.has(normalizeCompareName(product.name || "")))
    .map((product) => ({
      id: product.id,
      brand: product.brand,
      name: product.name,
      suggestedPrice: product.suggestedPrice ?? null,
      landtopPrice: null,
      landtopPriceLabel: "挑戰手機最低價",
      sourceUrl: product.jyesUrl,
      jyesPrice: product.jyesPrice ?? null,
      jyesPriceLabel: product.jyesPriceLabel,
      jyesUrl: product.jyesUrl,
      bestPrice: product.jyesPrice ?? null,
      bestSourceLabel: product.jyesPrice ? "傑昇通信" : null,
    }));

  return dropShellProductsWhenVariantsExist([...merged, ...jyesOnly]);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query") || "";
    const refresh = searchParams.get("refresh") === "1";

    const [landtopResult, jyesResult] = await Promise.all([
      fetchLandtopCatalog({ query, refresh }),
      fetchJyesCatalog({ query, refresh }),
    ]);

    const [snapshotResult, historyResult] = await Promise.all([
      persistLandtopSnapshots({ searchParams, products: landtopResult.products }),
      loadLandtopHistories({ searchParams, products: landtopResult.products }),
    ]);

    const products = mergeProducts(landtopResult.products as CompareProduct[], jyesResult.products as CompareProduct[]);
    const warnings = [...(landtopResult.warnings || [])];

    if (historyResult.error) {
      warnings.push(`歷史價格讀取失敗：${historyResult.error}`);
    }

    if (snapshotResult.error) {
      warnings.push(`歷史價格寫入失敗：${snapshotResult.error}`);
    }

    return NextResponse.json({
      ...landtopResult,
      source: "手機比價",
      sourceUrls: [...landtopResult.sourceUrls, jyesResult.sourceUrl],
      warnings,
      total: products.length,
      products,
      jyesFetchedAt: jyesResult.fetchedAt,
      histories: historyResult.histories,
      historyAvailable: historyResult.available,
      snapshotStored: snapshotResult.stored || 0,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "手機比價資料抓取失敗" },
      { status: 500 }
    );
  }
}
