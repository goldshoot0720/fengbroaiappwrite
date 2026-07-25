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
  // RAM/storage combos: 6G/128G, 6G 128GB, 256GB, etc.
  return /(\d{3,4}GB|\d{3,4}G|\d{1,2}G\s+\d{3,4}GB|\d{1,2}G\/\d{3,4}G)/i.test(name);
}

/** "Samsung A17 6G 128GB" / "Samsung A17" → "samsung a17" for shell vs variant grouping. */
function modelBaseKey(name) {
  return normalizeSpace(String(name || ""))
    .replace(/\b(\d{1,2})\s*G\s*\/\s*(\d{3,4})\s*G(B)?\b/gi, " ")
    .replace(/\b(\d{1,2})\s*G\s+(\d{3,4})\s*GB\b/gi, " ")
    .replace(/\b\d{3,4}\s*GB?\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Drop brand-list shells (e.g. "Samsung A17" @ lowest price) when capacity variants exist
 * ("Samsung A17 6G 128GB", "Samsung A17 8G 128GB").
 */
function dropShellProductsWhenVariantsExist(products) {
  const list = Array.isArray(products) ? products : [];
  const variantBases = new Set();
  const variantUrls = new Set();

  for (const product of list) {
    if (!hasVariantInfo(product.name)) continue;
    const base = modelBaseKey(product.name);
    if (base) variantBases.add(base);
    if (product.sourceUrl) variantUrls.add(product.sourceUrl);
  }

  if (variantBases.size === 0 && variantUrls.size === 0) return list;

  return list.filter((product) => {
    if (hasVariantInfo(product.name)) return true;
    const base = modelBaseKey(product.name);
    if (base && variantBases.has(base)) return false;
    if (product.sourceUrl && variantUrls.has(product.sourceUrl)) return false;
    return true;
  });
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

/** Capacity tokens like 6g / 8g / 128gb / 256g / bare 128 — not used alone to seed product-page expansion. */
function isCapacityToken(token) {
  return (
    /^\d{1,4}g(b)?$/i.test(token) ||
    /^\d{1,2}g\/\d{3,4}g(b)?$/i.test(token) ||
    /^\d{3,4}$/.test(token)
  );
}

function splitQueryTokens(query) {
  const tokens = normalizeQuery(query);
  const capacityTokens = [];
  const modelTokens = [];
  for (const token of tokens) {
    if (isCapacityToken(token)) capacityTokens.push(token);
    else modelTokens.push(token);
  }
  return { tokens, capacityTokens, modelTokens };
}

function productHaystack(product) {
  return normalizeSpace(
    `${product.brand} ${product.name}`.replace(/\b(\d{3,4})G\b/gi, "$1GB").replace(/\//g, " ")
  ).toLowerCase();
}

/**
 * Capacity must match whole tokens — "8g" must not match inside "128gb".
 */
function matchesCapacityToken(haystack, token) {
  const parts = haystack.split(/[^a-z0-9]+/i).filter(Boolean);
  const t = token.toLowerCase();
  if (parts.includes(t)) return true;
  // 128g ↔ 128gb
  if (/^\d{3,4}g$/.test(t) && parts.includes(`${t}b`)) return true;
  if (/^\d{3,4}gb$/.test(t) && parts.includes(t.replace(/gb$/, "g"))) return true;
  // bare "128" ↔ 128g / 128gb
  if (/^\d{3,4}$/.test(t)) {
    return parts.some((p) => p === `${t}g` || p === `${t}gb` || p === t);
  }
  return false;
}

function matchesTokens(product, tokens) {
  if (!tokens || tokens.length === 0) return true;
  const haystack = productHaystack(product);
  return tokens.every((token) =>
    isCapacityToken(token) ? matchesCapacityToken(haystack, token) : haystack.includes(token)
  );
}

function matchesQuery(product, query) {
  return matchesTokens(product, normalizeQuery(query));
}

/**
 * Extract capacity key from Landtop SKU / label, e.g.
 * "SA-a1760 6G/128G快閃灰" → "6G/128G"
 * "8G/128G" → "8G/128G"
 */
function extractCapacityKey(text) {
  if (!text) return "";
  const slash = String(text).match(/(\d{1,2})\s*G\s*\/\s*(\d{3,4})\s*G(B)?/i);
  if (slash) return `${slash[1]}G/${slash[2]}G`;
  const spaced = String(text).match(/(\d{1,2})\s*G\s+(\d{3,4})\s*GB/i);
  if (spaced) return `${spaced[1]}G/${spaced[2]}G`;
  const storageOnly = String(text).match(/\b(\d{3,4})\s*GB\b/i);
  if (storageOnly) return `${storageOnly[1]}GB`;
  return "";
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

function upsertBrandProduct(products, brand, name, sourceUrl, suggestedPrice, landtopPrice) {
  if (!isProductTitle(name, brand)) return;
  const id = createProductId(brand, name);
  products.set(id, {
    id,
    brand,
    name,
    suggestedPrice,
    landtopPrice,
    landtopPriceLabel:
      landtopPrice == null ? "挑戰手機最低價" : `NT$ ${landtopPrice.toLocaleString("zh-TW")}`,
    sourceUrl,
  });
}

function parseBrandProducts(html, brand) {
  if (html.includes("Markdown Content:") && html.includes("## [")) {
    const markdownProducts = parseBrandProductsFromMarkdown(html, brand);
    if (markdownProducts.length > 0) {
      return markdownProducts;
    }
  }

  const products = new Map();

  // Current brand layout: <a href="/products/..."><h2>Samsung A17</h2></a> … 建議售價 / 地標價
  const h2CardPattern =
    /href="(\/products\/[^"]+)"[^>]*>\s*<h2[^>]*>([\s\S]*?)<\/h2>/gi;
  let h2Match;
  while ((h2Match = h2CardPattern.exec(html)) !== null) {
    const sourceUrl = new URL(h2Match[1], "https://www.landtop.com.tw").toString();
    const name = normalizeSpace(stripTags(h2Match[2]));
    // Prices usually appear after the title block in brand list rows
    const chunk = html.slice(h2Match.index, h2Match.index + 1800);
    const suggestedMatch = chunk.match(/建議售價[\s\S]{0,80}?(\$?\s*[\d,]+)/i);
    const landtopMatch =
      chunk.match(/地標價[\s\S]{0,80}?(\$?\s*[\d,]+)/i) ||
      chunk.match(/挑戰手機最低價[\s\S]{0,80}?(\$?\s*[\d,]+)/i);
    upsertBrandProduct(
      products,
      brand,
      name,
      sourceUrl,
      parsePrice(suggestedMatch?.[1]),
      parsePrice(landtopMatch?.[1])
    );
  }

  // Legacy card layouts (h3 / product-name / img alt)
  const cardPattern =
    /<a[^>]+href="(\/products\/[^"]+)"[\s\S]{0,1800}?(?:<h3[^>]*>|<div class="product-name[^"]*">|<img[^>]+alt=")([\s\S]*?)(?:<\/h3>|<\/div>|")/gi;
  let match;

  while ((match = cardPattern.exec(html)) !== null) {
    const sourceUrl = new URL(match[1], "https://www.landtop.com.tw").toString();
    const name = normalizeSpace(stripTags(match[2]));
    if (products.has(createProductId(brand, name))) continue;

    const chunk = html.slice(match.index, match.index + 2400);
    const suggestedMatch = chunk.match(/建議售價[\s\S]{0,120}?(\$?\s*[\d,]+)/i);
    const landtopMatch =
      chunk.match(/地標價[\s\S]{0,120}?(\$?\s*[\d,]+)/i) ||
      chunk.match(/挑戰手機最低價[\s\S]{0,120}?(\$?\s*[\d,]+)/i);

    upsertBrandProduct(
      products,
      brand,
      name,
      sourceUrl,
      parsePrice(suggestedMatch?.[1]),
      parsePrice(landtopMatch?.[1])
    );
  }

  return Array.from(products.values());
}

/**
 * Parse Product JSON-LD offers (most accurate multi-SKU prices).
 * Samsung A17: 6G/128G → 5790, 8G/128G → 6790
 */
function parseProductJsonLdOffers(html, brand, sourceUrl) {
  const products = new Map();
  const blocks = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);

  for (const block of blocks) {
    let data;
    try {
      data = JSON.parse(block[1]);
    } catch {
      continue;
    }

    const nodes = Array.isArray(data) ? data : [data];
    for (const node of nodes) {
      if (!node || typeof node !== "object") continue;
      const offers = Array.isArray(node.offers)
        ? node.offers
        : node.offers
          ? [node.offers]
          : [];
      if (offers.length === 0) continue;

      const baseName = normalizeSpace(node.name || "");
      if (baseName && !isProductTitle(baseName, brand) && brand === "samsung" && !/^Samsung/i.test(baseName)) {
        // still allow if offers have phone SKUs
      }

      // capacity → lowest offer price (colors share same storage price)
      const byCapacity = new Map();
      for (const offer of offers) {
        if (!offer || typeof offer !== "object") continue;
        const capacity = extractCapacityKey(offer.sku || offer.name || "");
        if (!capacity) continue;
        const price = Number(offer.price);
        if (!Number.isFinite(price) || price <= 0) continue;
        const prev = byCapacity.get(capacity);
        if (!prev || price < prev.price) {
          byCapacity.set(capacity, { price, sku: offer.sku || "" });
        }
      }

      if (byCapacity.size === 0) continue;

      const modelName =
        baseName && isProductTitle(baseName, brand)
          ? baseName
          : brand === "samsung"
            ? `Samsung ${baseName || "Phone"}`.replace(/\s+/g, " ")
            : baseName || "Product";

      for (const [capacity, info] of byCapacity) {
        const name = normalizeVariantName(`${modelName} ${capacity}`);
        if (!isProductTitle(name, brand) && brand === "samsung" && !/^Samsung/i.test(name)) {
          continue;
        }
        const id = createProductId(brand, name);
        products.set(id, {
          id,
          brand,
          name,
          suggestedPrice: null,
          landtopPrice: info.price,
          landtopPriceLabel: `NT$ ${info.price.toLocaleString("zh-TW")}`,
          sourceUrl,
        });
      }
    }
  }

  return Array.from(products.values());
}

function parseProductVariantLinks(html) {
  const variants = new Map();
  // Storage option chips: data-product-id + data-variant-id + label-price (6G/128G, 8G/128G)
  const pattern =
    /data-product-id="(\d+)"[\s\S]{0,320}?data-variant-id="(\d+)"[\s\S]{0,280}?<div class="label-price">([^<]+)<\/div>/g;
  let match;

  while ((match = pattern.exec(html)) !== null) {
    const label = stripTags(match[3]);
    // Accept 6G/128G, 8G/128GB, 256GB, etc. — skip pure color chips without capacity
    if (!label || !/(\d{1,2}\s*G\s*\/\s*\d{3,4}\s*G|\d{3,4}\s*GB|\d{3,4}G)/i.test(label)) continue;
    variants.set(match[2], { productId: match[1], variantId: match[2], label });
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

  // Prefer JSON-LD multi-offer prices (accurate per RAM/storage, no extra XHR)
  const jsonLdProducts = parseProductJsonLdOffers(html, brand, url);
  if (jsonLdProducts.length > 0) {
    return { products: jsonLdProducts, fetchedVia };
  }

  const variantLinks = parseProductVariantLinks(html);

  if (variantLinks.length === 0) {
    const product = parseProductVariant(html, brand, url);
    return { products: product ? [product] : [], fetchedVia };
  }

  const variants = await Promise.all(
    variantLinks.map((variant) => fetchVariantProduct(brand, url, variant.productId, variant.variantId, refresh))
  );

  const products = variants.filter(Boolean);
  // If turbo-stream failed, still surface capacity labels with null price rather than nothing
  if (products.length === 0 && variantLinks.length > 0) {
    const pageProduct = parseProductVariant(html, brand, url);
    return {
      products: variantLinks.map((link) => {
        const cap = extractCapacityKey(link.label) || link.label;
        const name = normalizeVariantName(
          `${(pageProduct?.name || "").replace(/\s+\d{1,2}G.*$/i, "") || brand} ${cap}`
        );
        return {
          id: createProductId(brand, name),
          brand,
          name,
          suggestedPrice: pageProduct?.suggestedPrice ?? null,
          landtopPrice: pageProduct?.landtopPrice ?? null,
          landtopPriceLabel: pageProduct?.landtopPriceLabel || "挑戰手機最低價",
          sourceUrl: url,
        };
      }),
      fetchedVia,
    };
  }

  return {
    products,
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

  // Seed expansion with model tokens only so "a17 8g" still opens the A17 product page
  // (brand cards only say "Samsung A17" without RAM/storage).
  const { tokens, modelTokens } = splitQueryTokens(query);
  const seedTokens = modelTokens.length > 0 ? modelTokens : tokens;

  const matchedProducts = Array.from(allProducts.values()).filter((product) =>
    matchesTokens(product, seedTokens)
  );
  const expandableProducts = matchedProducts.filter(
    (product) => !hasVariantInfo(product.name) && /\/products\//i.test(product.sourceUrl || "")
  );

  const expandedGroups = await Promise.all(
    expandableProducts.map((product) => fetchProductVariantsFromUrl(product.brand, product.sourceUrl, refresh))
  );

  expandedGroups
    .flatMap((group) => group.products)
    .forEach((product) => {
      allProducts.set(product.id, product);
    });

  // Final filter uses full query including capacity (8g / 128gb …).
  // Then drop bare shells like "Samsung A17" when 6G/8G variants exist.
  const products = dropShellProductsWhenVariantsExist(
    Array.from(allProducts.values()).filter((product) => matchesTokens(product, tokens))
  ).sort((a, b) => {
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
