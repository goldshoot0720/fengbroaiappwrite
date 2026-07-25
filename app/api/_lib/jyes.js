const JYES_URL = "https://www.jyes.com.tw/product.php";
const READER_URL = `https://r.jina.ai/http://${JYES_URL}`;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36";

function normalizeSpace(value) {
  return value.replace(/\s+/g, " ").trim();
}

function parsePrice(value) {
  if (!value || value.includes("特價請洽門市") || value.includes("即將開賣")) return null;
  const raw = value.replace(/[^\d]/g, "");
  return raw ? Number(raw) : null;
}

function normalizeName(value) {
  return normalizeSpace(
    value
      .replace(/^三星/, "Samsung")
      .replace(/^蘋果/, "Apple")
      .replace(/\b(\d{3,4})G\b/gi, "$1GB")
      .replace(/[()]/g, " ")
      .replace(/\//g, " ")
  );
}

function inferBrand(value) {
  const lowered = value.toLowerCase();
  if (lowered.includes("iphone") || lowered.includes("apple")) return "apple";
  if (lowered.includes("samsung")) return "samsung";
  return "other";
}

/** Exclude cases / buds / watches — 手機比價只要手機本體. */
const NON_PHONE_RE =
  /保護殼|保護套|手機殼|背蓋|皮套|矽膠|透明殼|清水套|MagSafe|保護貼|玻璃貼|鏡頭貼|保護膜|滿版|膜$|充電|充電器|無線充|行動電源|旅充|車充|線材|傳輸線|耳機|Buds|AirPods|Watch|手環|平板|iPad|Tab\b|筆電|MacBook|鍵盤|滑鼠|支架|腳架|自拍|配件|卡匣|記憶卡|轉接|吊飾|背帶|鏡頭蓋|收納|殼$/i;

function isPhoneProduct(name, brand) {
  if (!name || name.length > 140) return false;
  if (NON_PHONE_RE.test(name)) return false;
  if (/系列/.test(name) && !/\d{2,4}\s*GB/i.test(name)) return false;
  if (brand === "samsung") {
    if (!/^Samsung\s+/i.test(name)) return false;
    if (/\b(Galaxy\s+)?(Buds|Watch|Tab|Book|Monitor|TV|Tag)\b/i.test(name)) return false;
    return true;
  }
  if (brand === "apple") {
    return /^iPhone\s+/i.test(name) || /^Apple\s+iPhone\b/i.test(name);
  }
  return false;
}

function normalizeQuery(value) {
  return normalizeSpace(value.replace(/\b(\d{3,4})G\b/gi, "$1GB").replace(/\//g, " "))
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

function matchesQuery(product, query) {
  const tokens = normalizeQuery(query);
  if (!tokens.length) return true;
  const haystack = normalizeQuery(`${product.brand} ${product.name}`).join(" ");
  return tokens.every((token) => haystack.includes(token));
}

function buildProductUrl(name) {
  const slug = name
    .replace(/\b(\d{3,4})GB\b/gi, "$1G")
    .replace(/^Samsung\s+/i, "SAMSUNG-")
    .replace(/^Apple\s+/i, "APPLE-")
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return `https://www.jyes.com.tw/product/${slug}`;
}

function parseJyesProducts(markdown) {
  const products = new Map();
  const rowPattern = /^([^\t\n]+?)(?:\n[^\t\n]+)*\n?\t([^\t\n]+)\t([^\t\n]+)\t([^\t\n]+)\t[^\t\n]+$/gm;
  let match;

  while ((match = rowPattern.exec(markdown)) !== null) {
    const rawName = normalizeSpace(match[1]);
    const name = normalizeName(rawName);
    const brand = inferBrand(name);
    if (brand === "other") continue;
    if (!isPhoneProduct(name, brand)) continue;

    const suggestedPrice = parsePrice(match[2]);
    const jyesPrice = parsePrice(match[4]);
    const id = `jyes-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;

    products.set(id, {
      id,
      brand,
      name,
      suggestedPrice,
      jyesPrice,
      jyesPriceLabel: jyesPrice == null ? "門市洽詢" : `NT$ ${jyesPrice.toLocaleString("zh-TW")}`,
      jyesUrl: buildProductUrl(name),
    });
  }

  return Array.from(products.values());
}

export async function fetchJyesCatalog({ query = "", refresh = false } = {}) {
  const response = await fetch(READER_URL, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/plain,text/html,*/*",
      "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
    },
    cache: refresh ? "no-store" : "force-cache",
  });

  if (!response.ok) {
    throw new Error(`傑昇通信資料讀取失敗，HTTP ${response.status}`);
  }

  const products = parseJyesProducts(await response.text()).filter((product) => matchesQuery(product, query));

  return {
    source: "傑昇通信",
    sourceUrl: JYES_URL,
    query,
    fetchedAt: new Date().toISOString(),
    total: products.length,
    products,
  };
}
