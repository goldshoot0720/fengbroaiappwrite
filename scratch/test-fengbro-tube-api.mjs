const response = await fetch("http://localhost:3000/api/fengbro-tube");
const data = await response.json();
console.log("status", response.status);
console.log("fetchedAt", data.fetchedAt);
console.log("sourceCount", data.sourceCount);
console.log("recentVideos", data.recentVideos?.length || 0);
console.log("downfallChannel", data.downfallChannel?.title, "videos", data.downfallChannel?.videos?.length || 0, "update", data.downfallChannel?.downfallIndexUpdate || null);

const summary = data.channels.map((channel) => ({
  title: channel.title,
  videos: channel.videos?.length || 0,
  error: channel.error || null,
  badTitle: /Error\s*\d+|Not Found|!!1/i.test(channel.title || ""),
  sample: channel.videos?.[0]?.title?.slice(0, 40) || "",
}));

console.log(JSON.stringify(summary, null, 2));
const empty = summary.filter((c) => c.videos === 0);
const bad = summary.filter((c) => c.badTitle || c.error);
console.log("empty channels", empty.length, empty.map((c) => c.title));
console.log("bad channels", bad.length, bad);
