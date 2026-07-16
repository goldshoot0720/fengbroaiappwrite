const headers = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "zh-TW,zh;q=0.9,en;q=0.8",
};

async function tryUrl(label, url, extraHeaders = {}) {
  try {
    const res = await fetch(url, { headers: { ...headers, ...extraHeaders } });
    const text = await res.text();
    const title = (text.match(/<title>(.*?)<\/title>/i)?.[1] || "").slice(0, 120);
    const channelId =
      text.match(/"externalId"\s*:\s*"(UC[\w-]+)"/)?.[1] ||
      text.match(/youtube\.com\/channel\/(UC[\w-]+)/)?.[1] ||
      text.match(/"channelId"\s*:\s*"(UC[\w-]+)"/)?.[1] ||
      null;
    console.log(label, {
      status: res.status,
      title,
      channelId,
      len: text.length,
      hasInitial: /ytInitialData/.test(text),
      head: text.slice(0, 200).replace(/\s+/g, " "),
    });
    return { status: res.status, title, channelId, text };
  } catch (e) {
    console.log(label, "ERR", String(e));
    return null;
  }
}

// Channel page
await tryUrl("channel-page", "https://www.youtube.com/@sunlao/videos");

// Consent / no-js variants
await tryUrl("channel-page-consent", "https://www.youtube.com/@sunlao/videos", {
  cookie: "CONSENT=YES+cb.20210328-17-p0.en+FX+667",
});

// RSS via handle? (doesn't work usually)
await tryUrl("feed-user", "https://www.youtube.com/feeds/videos.xml?user=sunlao");

// oEmbed
await tryUrl(
  "oembed",
  "https://www.youtube.com/oembed?url=" + encodeURIComponent("https://www.youtube.com/@sunlao") + "&format=json"
);

// innertube browse with handle
const innertubeBody = {
  context: {
    client: {
      clientName: "WEB",
      clientVersion: "2.20240101.00.00",
      hl: "zh-TW",
      gl: "TW",
    },
  },
  browseId: "@sunlao",
};

try {
  const res = await fetch("https://www.youtube.com/youtubei/v1/browse?prettyPrint=false", {
    method: "POST",
    headers: {
      ...headers,
      "content-type": "application/json",
      "x-youtube-client-name": "1",
      "x-youtube-client-version": "2.20240101.00.00",
    },
    body: JSON.stringify(innertubeBody),
  });
  const text = await res.text();
  const channelId = text.match(/"channelId"\s*:\s*"(UC[\w-]+)"/)?.[1] || text.match(/"browseId"\s*:\s*"(UC[\w-]+)"/)?.[1];
  console.log("innertube-browse", {
    status: res.status,
    len: text.length,
    channelId,
    sample: text.slice(0, 300).replace(/\s+/g, " "),
  });
} catch (e) {
  console.log("innertube-browse ERR", String(e));
}

// Try known channel id feed
await tryUrl("known-feed", "https://www.youtube.com/feeds/videos.xml?channel_id=UCgjypggfQ2s-H7ITdonS28Q");

// Production API
try {
  const res = await fetch("https://fengbroaiappwrite.vercel.app/api/fengbro-tube", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      channels: [{ sourceUrl: "https://www.youtube.com/@sunlao/videos", alias: "政經孫老師" }],
    }),
  });
  const data = await res.json();
  console.log("prod-api", {
    status: res.status,
    channels: data.channels?.map((c) => ({
      title: c.title,
      videos: c.videos?.length,
      error: c.error,
      channelId: c.channelId,
    })),
  });
} catch (e) {
  console.log("prod-api ERR", String(e));
}
