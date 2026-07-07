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

function parsePrice(line) {
  if (!line) return null;
  const raw = line.replace(/[^\d]/g, "");
  return raw ? Number(raw) : null;
}

function stripTags(value) {
  return normalizeSpace(decodeHtml(value.replace(/<[^>]+>/g, " ")));
}

function normalizeVariantName(value) {
  return normalizeSpace(value.replace(/\b(\d{3,4})G\b/gi, "$1GB").replace(/\//g, " "));
}

function hasVariantInfo(name) {
  return /(\d{3,4}GB|\d{3,4}G|\d+G\s+\d+GB|\d+G\/\d+G)/i.test(name);
}

function createProductId(brand, name) {
  return `${brand}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
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

function isProductTitle(name, brand) {
  if (!name || name.length > 120) return false;
  if (brand === "samsung") return /^Samsung\s+/i.test(name);
  return /^(iPhone|iPad|AirPods|Apple Watch|Apple\s+)/i.test(name);
}

function parseBrandProductsFromMarkdown(markdown, brand) {
  const products = new Map();
  const pattern =
    /##\s+\[([^\]]+)\]\((https:\/\/www\.landtop\.com\.tw\/products\/[^)]+)\)[\s\S]{0,240}?建議售價[:：]\$?([\d,]+)[\s\S]{0,120}?地標價[:：](挑戰手機最低價|\$?[\d,]+)/g;
  let match;

  while ((match = pattern.exec(markdown)) !== null) {
    const name = normalizeSpace(match[1]);
    if (!isProductTitle(name, brand)) continue;

    const suggestedPrice = parsePrice(match[3]);
    const landtopPrice = match[4].includes("挑戰手機最低價") ? null : parsePrice(match[4]);
    const id = createProductId(brand, name);

    products.set(id, {
      id,
      brand,
      name,
      suggestedPrice,
      landtopPrice,
      landtopPriceLabel: landtopPrice == null ? "挑戰手機最低價" : `NT$ ${landtopPrice.toLocaleString("zh-TW")}`,
      sourceUrl: match[2],
    });
  }

  return Array.from(products.values());
}

function parseBrandProducts(html, brand) {
  if (html.includes("Markdown Content:") && html.includes("## [")) {
    const markdownProducts = parseBrandProductsFromMarkdown(html, brand);
    if (markdownProducts.length > 0) {
      return markdownProducts;
    }
  }

  const products = new Map();
  const cardPattern =
    /<a[^>]+href="(\/products\/[^"]+)"[\s\S]{0,1800}?(?:<h3[^>]*>|<div class="product-name[^"]*">|<img[^>]+alt=")([\s\S]*?)(?:<\/h3>|<\/div>|")/gi;
  let match;

  while ((match = cardPattern.exec(html)) !== null) {
    const sourceUrl = new URL(match[1], "https://www.landtop.com.tw").toString();
    const name = normalizeSpace(stripTags(match[2]));
    if (!isProductTitle(name, brand)) continue;

    const chunk = html.slice(match.index, match.index + 2400);
    const suggestedMatch = chunk.match(/建議售價[\s\S]{0,120}?(\$?\s*[\d,]+)/i);
    const landtopMatch =
      chunk.match(/地標價[\s\S]{0,120}?(\$?\s*[\d,]+)/i) ||
      chunk.match(/挑戰手機最低價[\s\S]{0,120}?(\$?\s*[\d,]+)/i);

    const suggestedPrice = parsePrice(suggestedMatch?.[1]);
    const landtopPrice = parsePrice(landtopMatch?.[1]);
    const id = createProductId(brand, name);

    products.set(id, {
      id,
      brand,
      name,
      suggestedPrice,
      landtopPrice,
      landtopPriceLabel: landtopPrice == null ? "挑戰手機最低價" : `NT$ ${landtopPrice.toLocaleString("zh-TW")}`,
      sourceUrl,
    });
  }

  return Array.from(products.values());
}

function parseProductVariantLinks(html) {
  const variants = new Map();
  const pattern =
    /data-product-id="(\d+)"[\s\S]{0,220}?data-variant-id="(\d+)"[\s\S]{0,200}?<div class="label-price">([^<]+)<\/div>/g;
  let match;

  while ((match = pattern.exec(html)) !== null) {
    const label = stripTags(match[3]);
    if (!label || !/(\d{3,4}GB|\d{3,4}G|\d+G\/\d+G)/i.test(label)) continue;
    variants.set(match[2], { productId: match[1], variantId: match[2] });
  }

  return Array.from(variants.values());
}

function parseProductVariant(html, brand, sourceUrl) {
  const nameMatch = html.match(/<div class="price-product-name">([\s\S]*?)<\/div>/i);
  if (!nameMatch) return null;

  const rawName = stripTags(nameMatch[1]).split("|")[0];
  const name = normalizeVariantName(rawName);
  const suggestedMatch = html.match(/text-strikethrough[^"]*">([\s\S]*?)<\/div>/i);
  const discountMatch = html.match(/discount-price">([\s\S]*?)<\/div>/i);
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

function parseProductMarkdownVariants(markdown, brand, sourceUrl) {
  const normalized = markdown.replace(/\r/g, "");
  const storageSection = normalized.match(/儲存空間\s+([\s\S]*?)\s+顏色\s+/);
  const storageVariants = storageSection
    ? storageSection[1]
        .split("\n")
        .map((line) => normalizeSpace(line))
        .filter((line) => /(\d+G\/\d+G|\d+GB|\d+G)/i.test(line))
        .map((line) => normalizeVariantName(line))
    : [];

  const namePattern = new RegExp(
    `(${brand === "samsung" ? "Samsung" : "Apple|iPhone"}[^\\n]+?(?:\\d+G\\/\\d+G|\\d+GB|\\d+G\\s+\\d+GB))([\\s\\S]{0,220}?建議售價\\s*\\$?[\\d,]+[\\s\\S]{0,120}?地標(?:最低)?價[\\s\\S]{0,80}?\\$?[\\d,]+)`,
    "gi"
  );

  const products = new Map();
  let match;

  while ((match = namePattern.exec(normalized)) !== null) {
    const name = normalizeVariantName(match[1].split("|")[0]);
    const chunk = match[2];
    const suggestedPrice = parsePrice(chunk.match(/建議售價\s*\$?([\d,]+)/)?.[1]);
    const landtopPrice = parsePrice(chunk.match(/地標(?:最低)?價[\s\S]{0,40}?\$?([\d,]+)/)?.[1]);
    const id = createProductId(brand, name);

    products.set(id, {
      id,
      brand,
      name,
      suggestedPrice,
      landtopPrice,
      landtopPriceLabel: landtopPrice == null ? "挑戰手機最低價" : `NT$ ${landtopPrice.toLocaleString("zh-TW")}`,
      sourceUrl,
    });
  }

  if (products.size > 0) {
    return Array.from(products.values());
  }

  if (storageVariants.length > 0) {
    const baseNameMatch = normalized.match(/(?:^|\n)#?\s*Samsung\s+[^\n]+|(?:^|\n)#?\s*(?:Apple|iPhone)\s+[^\n]+/m);
    const baseName = normalizeSpace((baseNameMatch?.[0] || "").replace(/^#+\s*/, ""));
    const suggestedPrice = parsePrice(normalized.match(/建議售價\s*\$?([\d,]+)/)?.[1]);
    const landtopPrice = parsePrice(normalized.match(/地標(?:最低)?價[\s\S]{0,40}?\$?([\d,]+)/)?.[1]);

    if (baseName) {
      return storageVariants.map((variant) => {
        const name = normalizeVariantName(`${baseName} ${variant}`);
        const id = createProductId(brand, name);

        return {
          id,
          brand,
          name,
          suggestedPrice,
          landtopPrice,
          landtopPriceLabel: landtopPrice == null ? "挑戰手機最低價" : `NT$ ${landtopPrice.toLocaleString("zh-TW")}`,
          sourceUrl,
        };
      });
    }
  }

  return [];
}

async function fetchText(url, refresh, accept = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8") {
  const init = {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: accept,
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
    const directProducts = parseBrandProducts(await directResponse.text(), brand);
    if (directProducts.length > 0) {
      return {
        products: directProducts,
        fetchedVia: "direct",
      };
    }
  }

  const readerResponse = await fetchText(`${READER_BASE_URL}${url}`, refresh);
  if (!readerResponse.ok) {
    return {
      products: [],
      fetchedVia: directResponse.ok ? "direct" : "reader",
      warning: `地標網通 ${brand} 品牌頁抓取失敗：HTTP ${directResponse.status} / reader HTTP ${readerResponse.status}`,
    };
  }

  return {
    products: parseBrandProducts(await readerResponse.text(), brand),
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

async function loadProductPage(url, refresh) {
  const productResponse = await fetchText(url, refresh);
  if (productResponse.ok) {
    return { html: await productResponse.text(), fetchedVia: "direct" };
  }

  const readerResponse = await fetchText(`${READER_BASE_URL}${url}`, refresh);
  if (!readerResponse.ok) {
    throw new Error(`地標網通商品頁抓取失敗：HTTP ${productResponse.status} / reader HTTP ${readerResponse.status}`);
  }

  return { html: await readerResponse.text(), fetchedVia: "reader" };
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

  return fetchProductVariantsFromUrl(source.brand, source.url, refresh);
}

async function fetchProductVariantsFromUrl(brand, url, refresh) {
  if (!url || !/\/products\//i.test(url)) {
    return { products: [], fetchedVia: "direct" };
  }

  const { html, fetchedVia } = await loadProductPage(url, refresh);
  if (html.includes("Markdown Content:")) {
    const markdownProducts = parseProductMarkdownVariants(html, brand, url);
    if (markdownProducts.length > 0) {
      return { products: markdownProducts, fetchedVia };
    }
  }

  const variantLinks = parseProductVariantLinks(html);

  if (variantLinks.length === 0) {
    const product = parseProductVariant(html, brand, url);
    return { products: product ? [product] : [], fetchedVia };
  }

  const variants = await Promise.all(
    variantLinks.map((variant) => fetchVariantProduct(brand, url, variant.productId, variant.variantId, refresh))
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

  const matchedProducts = Array.from(allProducts.values()).filter((product) => matchesQuery(product, query));
  const expandableProducts = matchedProducts.filter(
    (product) => !hasVariantInfo(product.name) && /\/products\//i.test(product.sourceUrl)
  );

  const expandedGroups = await Promise.all(
    expandableProducts.map((product) => fetchProductVariantsFromUrl(product.brand, product.sourceUrl, refresh))
  );

  expandedGroups
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
    fetchedVia: Array.from(new Set([...productGroups, ...expandedGroups].map((group) => group.fetchedVia))),
    warnings,
    total: products.length,
    products,
  };
}
