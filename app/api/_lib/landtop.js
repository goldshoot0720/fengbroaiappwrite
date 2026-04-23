const CACHE_SECONDS = 7 * 24 * 60 * 60;
const READER_BASE_URL = "https://r.jina.ai/http://r.jina.ai/http://";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36";

const LANDTOP_SOURCES = [
  { brand: "samsung", url: "https://www.landtop.com.tw/brands?brand=samsung" },
  { brand: "apple", url: "https://www.landtop.com.tw/brands?brand=apple" },
];

const LANDTOP_PRODUCT_SOURCES = [
  {
    brand: "apple",
    url: "https://www.landtop.com.tw/products/apple-iphone-17",
    productId: "3313",
    variants: ["40", "41"],
  },
  {
    brand: "samsung",
    url: "https://www.landtop.com.tw/products/samsung-s26-ceab4a58-8c4f-4b86-9fbc-9bc3211457a9",
    productId: "3469",
    variants: ["396", "432"],
  },
];

function normalizeSpace(value) {
  return value.replace(/\s+/g, " ").trim();
}

function decodeHtml(value) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function htmlToLines(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "\n")
    .replace(/<style[\s\S]*?<\/style>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(a|p|div|li|h\d|span|button)>/gi, "\n")
    .replace(/<[^>]+>/g, "\n")
    .split("\n")
    .map((line) => normalizeSpace(decodeHtml(line)))
    .filter(Boolean);
}

function parsePrice(line) {
  if (!line) return null;
  const raw = line.replace(/[^\d]/g, "");
  return raw ? Number(raw) : null;
}

function stripTags(value) {
  return normalizeSpace(decodeHtml(value.replace(/<[^>]+>/g, " ")));
}

function normalizeVariantName(value) {
  return normalizeSpace(value.replace(/\b(\d{3,4})G\b/g, "$1GB").replace(/\//g, " "));
}

function normalizeProductLine(line, fallbackSourceUrl) {
  const markdownLink = line.match(/^#{0,3}\s*\[([^\]]+)\]\((https:\/\/www\.landtop\.com\.tw\/products\/[^)]+)\)/i);
  if (markdownLink) {
    return { name: normalizeSpace(markdownLink[1]), sourceUrl: markdownLink[2] };
  }

  return { name: normalizeSpace(line.replace(/^#{1,3}\s*/, "")), sourceUrl: fallbackSourceUrl };
}

function isProductTitle(line, brand) {
  if (line.length > 100) return false;

  if (brand === "samsung") {
    return /^Samsung\s+/i.test(line);
  }

  return /^(iPhone|iPad|AirPods|Apple Watch|Apple\s+)/i.test(line);
}

function createProductId(brand, name) {
  return `${brand}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

function parseProducts(html, brand, sourceUrl) {
  const lines = htmlToLines(html);
  const products = new Map();

  for (let index = 0; index < lines.length; index += 1) {
    const productLine = normalizeProductLine(lines[index], sourceUrl);
    const { name } = productLine;
    if (!isProductTitle(name, brand)) continue;

    const windowLines = lines.slice(index + 1, index + 14);
    const suggestedLine = windowLines.find((line) => line.includes("建議售價"));
    const landtopLine = windowLines.find((line) => line.includes("地標價"));
    if (!suggestedLine && !landtopLine) continue;

    const suggestedPrice = parsePrice(suggestedLine);
    const landtopPrice = parsePrice(landtopLine);
    const id = createProductId(brand, name);

    products.set(id, {
      id,
      brand,
      name,
      suggestedPrice,
      landtopPrice,
      landtopPriceLabel: landtopPrice == null ? "挑戰手機最低價" : `NT$ ${landtopPrice.toLocaleString("zh-TW")}`,
      sourceUrl: productLine.sourceUrl,
    });
  }

  return Array.from(products.values());
}

function parseProductVariantLinks(html) {
  const variants = new Map();
  const pattern =
    /data-product-id="(\d+)"[\s\S]{0,220}?data-variant-id="(\d+)"[\s\S]{0,160}?<div class="label-price">([^<]+)<\/div>/g;
  let match;

  while ((match = pattern.exec(html)) !== null) {
    const label = stripTags(match[3]);
    if (!label || !/(\d{3,4}GB|\d{3,4}G|\d+G\/\d+G)/i.test(label)) continue;
    variants.set(match[2], { productId: match[1], variantId: match[2] });
  }

  return Array.from(variants.values());
}

function parseProductVariant(html, brand, sourceUrl) {
  const nameMatch = html.match(/<div class="price-product-name">([\s\S]*?)<\/div>/);
  if (!nameMatch) return null;

  const rawName = stripTags(nameMatch[1]).split("|")[0];
  const name = normalizeVariantName(rawName);
  const suggestedMatch = html.match(/<div class="text-secondary text-strikethrough[^"]*">([\s\S]*?)<\/div>/);
  const discountMatch = html.match(/<div class="text-red discount-price">([\s\S]*?)<\/div>/);
  const suggestedPrice = parsePrice(stripTags(suggestedMatch?.[1] || ""));
  const landtopLabel = stripTags(discountMatch?.[1] || "");
  const landtopPrice = parsePrice(landtopLabel);
  const id = createProductId(brand, name);

  return {
    id,
    brand,
    name,
    suggestedPrice,
    landtopPrice,
    landtopPriceLabel: landtopPrice == null ? landtopLabel || "挑戰手機最低價" : `NT$ ${landtopPrice.toLocaleString("zh-TW")}`,
    sourceUrl,
  };
}

function normalizeQuery(value) {
  return normalizeSpace(value.replace(/\b(\d{3,4})G\b/gi, "$1GB").replace(/\//g, " "))
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

function matchesQuery(product, query) {
  const tokens = normalizeQuery(query);
  if (tokens.length === 0) return true;

  const haystack = normalizeSpace(
    `${product.brand} ${product.name}`.replace(/\b(\d{3,4})G\b/gi, "$1GB").replace(/\//g, " ")
  ).toLowerCase();

  return tokens.every((token) => haystack.includes(token));
}

async function fetchText(url, refresh) {
  const init = {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
      Referer: "https://www.landtop.com.tw/",
    },
    cache: refresh ? "no-store" : "force-cache",
  };

  if (!refresh) {
    init.next = { revalidate: CACHE_SECONDS };
  }

  return fetch(url, init);
}

async function fetchBrandProducts(brand, url, refresh) {
  const directResponse = await fetchText(url, refresh);

  if (directResponse.ok) {
    return {
      products: parseProducts(await directResponse.text(), brand, url),
      fetchedVia: "direct",
    };
  }

  const readerResponse = await fetchText(`${READER_BASE_URL}${url}`, refresh);

  if (!readerResponse.ok) {
    throw new Error(`地標網通 ${brand} 品牌頁抓取失敗：HTTP ${directResponse.status} / reader HTTP ${readerResponse.status}`);
  }

  return {
    products: parseProducts(await readerResponse.text(), brand, url),
    fetchedVia: "reader",
  };
}

async function fetchVariantProduct(brand, url, productId, variantId, refresh) {
  const variantUrl = `https://www.landtop.com.tw/products/variants?product_id=${productId}&variant_id=${variantId}`;
  const init = {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/vnd.turbo-stream.html",
      "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
      "X-Requested-With": "XMLHttpRequest",
      Referer: url,
    },
    cache: refresh ? "no-store" : "force-cache",
  };

  if (!refresh) {
    init.next = { revalidate: CACHE_SECONDS };
  }

  const response = await fetch(variantUrl, init);
  if (!response.ok) return null;
  return parseProductVariant(await response.text(), brand, url);
}

async function fetchProductVariants(source, refresh) {
  const staticVariants = await Promise.all(
    source.variants.map((variantId) =>
      fetchVariantProduct(source.brand, source.url, source.productId, variantId, refresh)
    )
  );

  const staticProducts = staticVariants.filter(Boolean);
  if (staticProducts.length > 0) {
    return { products: staticProducts, fetchedVia: "direct" };
  }

  const productResponse = await fetchText(source.url, refresh);
  let productHtml = "";
  let fetchedVia = "direct";

  if (productResponse.ok) {
    productHtml = await productResponse.text();
  } else {
    const readerResponse = await fetchText(`${READER_BASE_URL}${source.url}`, refresh);
    if (!readerResponse.ok) {
      throw new Error(
        `地標網通 ${source.brand} 商品頁抓取失敗：HTTP ${productResponse.status} / reader HTTP ${readerResponse.status}`
      );
    }
    productHtml = await readerResponse.text();
    fetchedVia = "reader";
  }

  const variantLinks = parseProductVariantLinks(productHtml);
  if (variantLinks.length === 0) {
    const product = parseProductVariant(productHtml, source.brand, source.url);
    return { products: product ? [product] : [], fetchedVia };
  }

  const variants = await Promise.all(
    variantLinks.map((variant) =>
      fetchVariantProduct(source.brand, source.url, variant.productId, variant.variantId, refresh)
    )
  );

  return {
    products: variants.filter(Boolean),
    fetchedVia,
  };
}

export async function fetchLandtopCatalog({ query = "", refresh = false } = {}) {
  const productGroups = await Promise.all([
    ...LANDTOP_SOURCES.map((source) => fetchBrandProducts(source.brand, source.url, refresh)),
    ...LANDTOP_PRODUCT_SOURCES.map((source) => fetchProductVariants(source, refresh)),
  ]);

  const warnings = productGroups.flatMap((group) => (group.warning ? [group.warning] : []));
  const allProducts = new Map();

  productGroups
    .flatMap((group) => group.products)
    .forEach((product) => allProducts.set(product.id, product));

  const products = Array.from(allProducts.values())
    .filter((product) => matchesQuery(product, query))
    .sort((a, b) => {
      const aPrice = a.landtopPrice ?? a.suggestedPrice ?? Number.MAX_SAFE_INTEGER;
      const bPrice = b.landtopPrice ?? b.suggestedPrice ?? Number.MAX_SAFE_INTEGER;
      return aPrice - bPrice;
    });

  return {
    source: "地標網通",
    sourceUrls: [...LANDTOP_SOURCES, ...LANDTOP_PRODUCT_SOURCES].map((source) => source.url),
    query,
    refresh,
    cacheSeconds: CACHE_SECONDS,
    fetchedAt: new Date().toISOString(),
    fetchedVia: Array.from(new Set(productGroups.map((group) => group.fetchedVia))),
    warnings,
    total: products.length,
    products,
  };
}
