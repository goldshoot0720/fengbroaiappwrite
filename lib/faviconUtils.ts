/**
 * Favicon 工具函數
 */

// 已知網站的 favicon URL 映射（從 <link rel="icon"> 標籤獲取）
const KNOWN_FAVICON_URLS: Record<string, string> = {
  // 常用網站
  'github.com': 'https://github.githubassets.com/favicons/favicon.svg',
  'gmail.com': 'https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico',
  'mail.google.com': 'https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico',
  'outlook.com': 'https://outlook.live.com/favicon.ico',
  'outlook.live.com': 'https://outlook.live.com/favicon.ico',
  'suno.com': 'https://suno.com/favicon.ico',
  'sora.com': 'https://sora.com/favicon.ico',
  'qoder.com': 'https://img.alicdn.com/imgextra/i3/O1CN01KliT1u1jEq947NlKH_!!6000000004517-55-tps-180-180.svg',
  
  // AI & Tech Services
  'openai.com': 'https://openai.com/favicon.ico',
  'chat.openai.com': 'https://openai.com/favicon.ico',
  'claude.ai': 'https://claude.ai/favicon.ico',
  'anthropic.com': 'https://anthropic.com/favicon.ico',
  'gemini.google.com': 'https://www.gstatic.com/lamda/images/favicon_v1_150160cddff7f294ce30.svg',
  'copilot.microsoft.com': 'https://copilot.microsoft.com/rp/r1cCr-sT8LJJzjX_fwBVSGU9vkQ.br.gz.svg',
  'midjourney.com': 'https://midjourney.com/apple-touch-icon.png',
  'leonardo.ai': 'https://leonardo.ai/favicon.ico',
  'stability.ai': 'https://stability.ai/favicon.ico',
  'runway.ml': 'https://runway.ml/favicon.ico',
  'runwayml.com': 'https://runwayml.com/favicon.ico',
  'pika.art': 'https://pika.art/favicon.ico',
  'vercel.com': 'https://vercel.com/favicon.ico',
  'netlify.com': 'https://netlify.com/favicon.ico',
  
  // Streaming & Media
  'netflix.com': 'https://www.netflix.com/favicon.ico',
  'www.netflix.com': 'https://www.netflix.com/favicon.ico',
  'spotify.com': 'https://www.spotify.com/favicon.ico',
  'www.spotify.com': 'https://www.spotify.com/favicon.ico',
  'youtube.com': 'https://www.youtube.com/favicon.ico',
  'www.youtube.com': 'https://www.youtube.com/favicon.ico',
  'disneyplus.com': 'https://www.disneyplus.com/favicon.ico',
  'www.disneyplus.com': 'https://www.disneyplus.com/favicon.ico',
  'hulu.com': 'https://www.hulu.com/favicon.ico',
  'www.hulu.com': 'https://www.hulu.com/favicon.ico',
  'twitch.tv': 'https://static.twitchcdn.net/assets/favicon-32-e29e246c157142c94346.png',
  'www.twitch.tv': 'https://static.twitchcdn.net/assets/favicon-32-e29e246c157142c94346.png',
  'kkbox.com': 'https://www.kkbox.com/favicon.ico',
  'www.kkbox.com': 'https://www.kkbox.com/favicon.ico',
  
  // Cloud Storage
  'dropbox.com': 'https://www.dropbox.com/static/images/favicon-vflUeLeeY.ico',
  'www.dropbox.com': 'https://www.dropbox.com/static/images/favicon-vflUeLeeY.ico',
  'drive.google.com': 'https://ssl.gstatic.com/images/branding/product/2x/drive_2020q4_48dp.png',
  'onedrive.live.com': 'https://onedrive.live.com/favicon.ico',
  'icloud.com': 'https://www.icloud.com/favicon.ico',
  'www.icloud.com': 'https://www.icloud.com/favicon.ico',
  
  // Social Media
  'facebook.com': 'https://www.facebook.com/favicon.ico',
  'www.facebook.com': 'https://www.facebook.com/favicon.ico',
  'twitter.com': 'https://abs.twimg.com/favicons/twitter.2.ico',
  'x.com': 'https://abs.twimg.com/favicons/twitter.2.ico',
  'instagram.com': 'https://www.instagram.com/static/images/ico/favicon.ico/36b3ee2d91ed.ico',
  'www.instagram.com': 'https://www.instagram.com/static/images/ico/favicon.ico/36b3ee2d91ed.ico',
  'linkedin.com': 'https://static.licdn.com/sc/h/al2o9zrvru7aqj8e1x2rzsrca',
  'www.linkedin.com': 'https://static.licdn.com/sc/h/al2o9zrvru7aqj8e1x2rzsrca',
  'discord.com': 'https://discord.com/assets/f9bb9c4af2b9c32a2c5ee0014661546d.ico',
  
  // Productivity
  'notion.so': 'https://www.notion.so/images/favicon.ico',
  'www.notion.so': 'https://www.notion.so/images/favicon.ico',
  'trello.com': 'https://trello.com/favicon.ico',
  'www.trello.com': 'https://trello.com/favicon.ico',
  'slack.com': 'https://a.slack-edge.com/80588/marketing/img/meta/favicon-32.png',
  'www.slack.com': 'https://a.slack-edge.com/80588/marketing/img/meta/favicon-32.png',
  'zoom.us': 'https://st1.zoom.us/static/6.3.21739/image/new/favicon/favicon.ico',
  'www.zoom.us': 'https://st1.zoom.us/static/6.3.21739/image/new/favicon/favicon.ico',
  'meet.google.com': 'https://www.gstatic.com/meet/ic_product_meetings_48dp_20191014_r5_2x.png',
  'teams.microsoft.com': 'https://statics.teams.cdn.office.net/evergreen-assets/icons/favicon_24x24.png',
  
  // News & Reading
  'medium.com': 'https://medium.com/favicon.ico',
  'www.medium.com': 'https://medium.com/favicon.ico',
  'substack.com': 'https://substack.com/favicon.ico',
  'www.substack.com': 'https://substack.com/favicon.ico',
  
  // 銀行網站
  'ebank.taipeifubon.com.tw': 'https://ebank.taipeifubon.com.tw/B2C/inc/img/icon/favicon.ico',
  'www.esunbank.com.tw': 'https://www.esunbank.com.tw/bank/rwd/images/esun.ico',
  'esunbank.com.tw': 'https://www.esunbank.com.tw/bank/rwd/images/esun.ico',
  'www.cathaybk.com.tw': 'https://www.cathaybk.com.tw/etc.clientlibs/cub-aem-cs/clientlibs/clientlib-react/resources/favicon.ico',
  'cathaybk.com.tw': 'https://www.cathaybk.com.tw/etc.clientlibs/cub-aem-cs/clientlibs/clientlib-react/resources/favicon.ico',
};

/**
 * 從 URL 獲取 favicon URL（直接從網站獲取）
 * @param siteUrl 網站 URL
 * @returns favicon URL 陣列
 */
export function getFaviconUrlsOrdered(siteUrl: string): string[] {
  if (!siteUrl) return [];
  
  try {
    const url = new URL(siteUrl);
    const hostname = url.hostname;
    const origin = url.origin;
    
    // 檢查是否有已知的 favicon URL
    const knownFavicon = KNOWN_FAVICON_URLS[hostname] || KNOWN_FAVICON_URLS[hostname.replace('www.', '')];
    
    if (knownFavicon) {
      return [
        knownFavicon,
        `${origin}/favicon.ico`, // fallback
      ];
    }
    
    // 預設：直接從網站獲取 favicon.ico
    return [
      `${origin}/favicon.ico`,
    ];
  } catch {
    return [];
  }
}
