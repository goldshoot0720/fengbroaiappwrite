/** URL normalize / article URL heuristics for Fengbro News. */

import { normalizeDomain } from "@/lib/fengbroNewsSites";

export function absoluteUrl(base: string, href: string) {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

export function canonicalizeUrl(url: string) {
  try {
    const u = new URL(url);
    u.hash = "";
    // Prefer stable article id (+ con) for traffic bureau deep links
    if (u.hostname.includes("traffic.tycg.gov.tw")) {
      const p0 = u.searchParams.get("p0");
      const con = u.searchParams.get("con");
      u.search = "";
      if (p0) u.searchParams.set("p0", p0);
      if (con) u.searchParams.set("con", con);
    }
    if (u.hostname.includes("zhongli.tycg.gov.tw")) {
      const n = u.searchParams.get("n");
      const sms = u.searchParams.get("sms");
      const s = u.searchParams.get("s");
      if (u.pathname.toLowerCase().includes("news_content") && s) {
        u.search = "";
        if (n) u.searchParams.set("n", n);
        if (sms) u.searchParams.set("sms", sms);
        u.searchParams.set("s", s);
      }
    }
    // Normalize trailing slash for rb article paths
    if (u.hostname.includes("rb.gov.tw") && /\/\d{8}_\d+\/?$/.test(u.pathname)) {
      u.pathname = u.pathname.replace(/\/?$/, "/");
    }
    return u.toString();
  } catch {
    return url;
  }
}

export function hostMatchesDomain(url: string, domain: string) {
  try {
    const host = normalizeDomain(new URL(url).hostname);
    const d = domain.replace(/^www\./, "");
    if (host === d || host.endsWith(`.${d}`)) return true;
    // Cross-subdomain news search hosts (search.ltn.com.tw ↔ ltn.com.tw)
    const root = d.split(".").slice(-2).join(".");
    const hostRoot = host.split(".").slice(-2).join(".");
    if (root.length > 3 && hostRoot === root) return true;
    return false;
  } catch {
    return false;
  }
}

/** Strip scripts/styles/comments so ad JS (DFP/prebid) never becomes a fake title. */

export function isJunkNewsUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const path = u.pathname.toLowerCase();
    const full = url.toLowerCase();
    if (u.protocol === "javascript:" || u.protocol === "data:") return true;
    if (!path || path === "/") return true;
    if (
      /\/(ads?|advert|banner|track|pixel|click|logout|login|register|search\/tagging)\b/i.test(path) ||
      /doubleclick|googlesyndication|scorecardresearch|facebook\.com\/tr|analytics/i.test(full)
    ) {
      return true;
    }
    // UDN family (udn.com / sdgs.udn.com / …): keep real story paths
    if (u.hostname.includes("udn.com")) {
      if (/\/(static|upf|css|js|img|font|ads?)\//i.test(path)) return true;
      if (/\/story\//i.test(path) && /\d{4,}/.test(path)) return false;
      if (/\/news\/breaknews\//i.test(path) && /\d/.test(path)) return false;
      if (/\/news\/paper\//i.test(path)) return false;
      // Category / channel indexes are not articles
      return true;
    }
    // leho WordPress posts
    if (u.hostname.includes("leho.com.tw")) {
      if (/\/archives\/\d+/i.test(path)) return false;
      if (/\/archives\/category\//i.test(path)) return true;
      return !/\/\d{4,}/.test(path);
    }
    // Bella 儂儂 articles: /articles/{cat}/{id}/{slug}
    if (u.hostname.includes("bella.tw")) {
      if (/\/articles\/[^/]+\/\d+\//i.test(path)) return false;
      return true;
    }
    // 桃園市政府 / 各局處 news content pages
    if (u.hostname.includes("tycg.gov.tw")) {
      if (/News_Content\.aspx/i.test(path) || /NewsPage\.aspx/i.test(path)) return false;
      if (/Advanced_Search\.aspx/i.test(path) || /\/News\.aspx$/i.test(path)) return true;
      // keep deep paths with numeric ids
      if (/\d{4,}/.test(path + u.search)) return false;
      return true;
    }
    // 行政院
    if (u.hostname.includes("ey.gov.tw")) {
      if (/\/Page\//i.test(path) && /[A-F0-9]{8,}/i.test(path)) return false;
      if (/News|news|消息|新聞/i.test(path + u.search) && /\d{3,}/.test(path + u.search)) return false;
      if (/search|Search|PageList/i.test(path)) return true;
      return !/\d{4,}/.test(path + u.search);
    }
    // 客新聞 / MyGo (often WP-like numeric or slug posts)
    if (u.hostname.includes("hakkanews.tw") || u.hostname.includes("mygo.com")) {
      if (/\/\d{4}\/\d{2}\//.test(path) || /\/archives\/\d+/i.test(path) || /\/\d{4,}/.test(path)) return false;
      if (/\/(category|tag|author|page)\//i.test(path)) return true;
      // slug articles without date folder
      if (path.split("/").filter(Boolean).length >= 1 && !/\/(wp-|feed|login)/i.test(path)) {
        if (path !== "/" && !/\.(css|js|png|jpg|svg)$/i.test(path)) return false;
      }
      return true;
    }
    // 今周刊
    if (u.hostname.includes("businesstoday.com.tw")) {
      if (/\/article\/category\/\d+\/\d+/i.test(path) || /\/article\//i.test(path)) return false;
      if (/\/search/i.test(path)) return true;
      return !/\d{5,}/.test(path);
    }
    // Yahoo 奇摩新聞
    if (u.hostname.includes("yahoo.com")) {
      if (/\/search/i.test(path)) return true;
      // story slugs often end with html id
      if (/\.html$/i.test(path) || /-\d{6,}\.html$/i.test(path)) return false;
      if (path.split("/").filter(Boolean).length >= 1 && /[\u4e00-\u9fffA-Za-z0-9-]{8,}/.test(path)) return false;
      return true;
    }
    // 住商新聞 homeplus
    if (u.hostname.includes("homeplus.net.tw")) {
      if (/\/\d{4}\/\d{2}\//.test(path) || /\/archives\/\d+/i.test(path) || /\/\d{4,}/.test(path)) return false;
      if (/\/(category|tag|author|page|wp-)\//i.test(path)) return true;
      if (path.split("/").filter(Boolean).length >= 1 && !/\.(css|js|png|jpg)$/i.test(path)) return false;
      return true;
    }
    // 桃園市議會
    if (u.hostname.includes("tycc.gov.tw")) {
      if (/News|news|訊息|公告|Content|content/i.test(path + u.search) && /\d{3,}/.test(path + u.search)) return false;
      if (/home\.jsp/i.test(path) && !/\d{4,}/.test(u.search)) return true;
      return !/\d{4,}/.test(path + u.search);
    }
    // 交通部
    if (u.hostname.includes("motc.gov.tw")) {
      if (/home\.jsp/i.test(path) && /id=\d+/i.test(u.search) && /dataserno|news|News/i.test(path + u.search)) return false;
      if (/\/ch\/home\.jsp/i.test(path) && /\d{5,}/.test(u.search)) return false;
      if (/parentpath|id=\d+/i.test(u.search) && /\d{6,}/.test(u.search)) return false;
      // keep deep content ids
      if (/\d{6,}/.test(path + u.search)) return false;
      return true;
    }
    // AN 新聞
    if (u.hostname.includes("annewsmedia.com")) {
      if (/\/\d{4}\/\d{2}\//.test(path) || /\/archives\/\d+/i.test(path) || /\/\d{4,}/.test(path)) return false;
      if (/\/(category|tag|author|page)\//i.test(path)) return true;
      if (path.split("/").filter(Boolean).length >= 1) return false;
      return true;
    }
    // 好房網新聞
    if (u.hostname.includes("housefun.com.tw")) {
      if (/\/news\/\d+/i.test(path) || /\/article\//i.test(path) || /\/\d{5,}/.test(path)) return false;
      if (/\/(search|tag|category)\//i.test(path)) return true;
      return !/\d{4,}/.test(path);
    }
    // 住展
    if (u.hostname.includes("myhousing.com.tw")) {
      if (/\/\d{4}\/\d{2}\//.test(path) || /\/archives\/\d+/i.test(path) || /\/news\//i.test(path)) return false;
      if (/\/(category|tag|author|page)\//i.test(path)) return true;
      if (/\d{4,}/.test(path)) return false;
      return true;
    }
    // 樂居
    if (u.hostname.includes("leju.com.tw")) {
      if (/\/\d{4}\/\d{2}\//.test(path) || /\/archives\/\d+/i.test(path) || /\/news\//i.test(path) || /\/\d{4,}/.test(path)) return false;
      if (/\/(category|tag|author|page|search)\//i.test(path)) return true;
      if (path.split("/").filter(Boolean).length >= 1) return false;
      return true;
    }
    // 工商時報
    if (u.hostname.includes("ctee.com.tw")) {
      if (/\/\d{6,}/.test(path) || /\/article\//i.test(path) || /\/\d{4}\/\d{2}\//.test(path)) return false;
      if (/\/search/i.test(path)) return true;
      return !/\d{5,}/.test(path);
    }
    // 桃園電子報
    if (u.hostname.includes("tyenews.com")) {
      if (/\/\d{4}\/\d{2}\//.test(path) || /\/archives\/\d+/i.test(path) || /\/\d{4,}/.test(path)) return false;
      if (/\/(category|tag|author|page)\//i.test(path)) return true;
      if (path.split("/").filter(Boolean).length >= 1) return false;
      return true;
    }
    // 樞紐新聞
    if (u.hostname.includes("thehubnews.net")) {
      if (/\/\d{4}\/\d{2}\//.test(path) || /\/archives\/\d+/i.test(path) || /\/\d{4,}/.test(path)) return false;
      if (/\/(category|tag|author|page)\//i.test(path)) return true;
      if (path.split("/").filter(Boolean).length >= 1) return false;
      return true;
    }
    // 風傳媒 / 新新聞 storm.mg
    if (u.hostname.includes("storm.mg")) {
      if (/\/article\/\d+/i.test(path) || /\/\d{5,}/.test(path)) return false;
      if (/\/(category|tag|author|search|page)\//i.test(path)) return true;
      return true;
    }
    // Mobile01 討論串
    if (u.hostname.includes("mobile01.com")) {
      if (/topicdetail\.php/i.test(path) && /[?&]t=\d+/i.test(u.search)) return false;
      if (/\/topic\/\d+/i.test(path)) return false;
      if (/googlesearch|topiclist|forumtopic/i.test(path)) return true;
      return true;
    }
    // chinatimes articles usually have long numeric id in path
    if (u.hostname.includes("chinatimes.com")) {
      if (/\/\d{6,}(?:\.html)?/i.test(path) || /\/realtimenews\//i.test(path)) return false;
      if (/\/search\//i.test(path)) return true;
      return true;
    }
    // LTN story paths usually /news/ or /category/
    if (u.hostname.includes("ltn.com.tw")) {
      if (!/\/(news|article|politics|society|world|business|sports|life|local|entertainment)\//i.test(path) && !/search\.ltn/.test(u.hostname)) {
        // keep search.ltn result pages that link to news
        if (!/\d{5,}/.test(path)) return true;
      }
    }
    // China Times articles
    if (u.hostname.includes("chinatimes.com")) {
      if (!/\/(realtimenews|newspapers|opinion|life|money|sports|star|society|world|chinese|news)\//i.test(path) && !/\/search\//i.test(path)) {
        if (!/\d{6,}/.test(path)) return true;
      }
    }
    return false;
  } catch {
    return true;
  }
}

export function isLikelyArticleUrl(url: string, domain: string): boolean {
  if (isJunkNewsUrl(url)) return false;
  try {
    const u = new URL(url);
    const path = u.pathname;
    // PTT posts
    if (domain.includes("ptt.cc")) return /\/bbs\/[^/]+\/M\.\d+\.A\./i.test(path);
    // Generic: avoid pure category indexes without article id
    if (/\/(index|home|default)(\.(html?|aspx|php))?$/i.test(path) && !/\d{5,}/.test(path)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

