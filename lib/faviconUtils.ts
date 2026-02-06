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
  
  // 銀行網站 - 台灣主要銀行
  // 富邦銀行
  'ebank.taipeifubon.com.tw': 'https://ebank.taipeifubon.com.tw/B2C/inc/img/icon/favicon.ico',
  'www.taipeifubon.com.tw': 'https://www.taipeifubon.com.tw/favicon.ico',
  'taipeifubon.com.tw': 'https://www.taipeifubon.com.tw/favicon.ico',
  
  // 玉山銀行
  'www.esunbank.com.tw': 'https://www.esunbank.com.tw/bank/rwd/images/esun.ico',
  'esunbank.com.tw': 'https://www.esunbank.com.tw/bank/rwd/images/esun.ico',
  
  // 國泰世華銀行
  'www.cathaybk.com.tw': 'https://www.cathaybk.com.tw/etc.clientlibs/cub-aem-cs/clientlibs/clientlib-react/resources/favicon.ico',
  'cathaybk.com.tw': 'https://www.cathaybk.com.tw/etc.clientlibs/cub-aem-cs/clientlibs/clientlib-react/resources/favicon.ico',
  
  // 中國信託
  'www.ctbcbank.com': 'https://www.ctbcbank.com/content/dam/cmb-tw/favicon.ico',
  'ctbcbank.com': 'https://www.ctbcbank.com/content/dam/cmb-tw/favicon.ico',
  
  // 台新銀行
  'www.taishinbank.com.tw': 'https://www.taishinbank.com.tw/TS/Static/favicon.ico',
  'taishinbank.com.tw': 'https://www.taishinbank.com.tw/TS/Static/favicon.ico',
  
  // 永豐銀行
  'bank.sinopac.com': 'https://bank.sinopac.com/favicon.ico',
  'www.bank.sinopac.com': 'https://bank.sinopac.com/favicon.ico',
  
  // 第一銀行
  'www.firstbank.com.tw': 'https://www.firstbank.com.tw/sites/default/files/favicon.ico',
  'firstbank.com.tw': 'https://www.firstbank.com.tw/sites/default/files/favicon.ico',
  
  // 華南銀行
  'www.hncb.com.tw': 'https://www.hncb.com.tw/favicon.ico',
  'hncb.com.tw': 'https://www.hncb.com.tw/favicon.ico',
  
  // 兆豐銀行
  'www.megabank.com.tw': 'https://www.megabank.com.tw/favicon.ico',
  'megabank.com.tw': 'https://www.megabank.com.tw/favicon.ico',
  
  // 合作金庫
  'www.tcb-bank.com.tw': 'https://www.tcb-bank.com.tw/favicon.ico',
  'tcb-bank.com.tw': 'https://www.tcb-bank.com.tw/favicon.ico',
  
  // 土地銀行
  'www.landbank.com.tw': 'https://www.landbank.com.tw/favicon.ico',
  'landbank.com.tw': 'https://www.landbank.com.tw/favicon.ico',
  
  // 彰化銀行
  'www.bankchb.com': 'https://www.bankchb.com/favicon.ico',
  'bankchb.com': 'https://www.bankchb.com/favicon.ico',
  
  // 台灣企銀
  'www.tbb.com.tw': 'https://www.tbb.com.tw/favicon.ico',
  'tbb.com.tw': 'https://www.tbb.com.tw/favicon.ico',
  
  // 上海商銀
  'www.scsb.com.tw': 'https://www.scsb.com.tw/favicon.ico',
  'scsb.com.tw': 'https://www.scsb.com.tw/favicon.ico',
  
  // 渣打銀行
  'www.sc.com': 'https://www.sc.com/favicon.ico',
  'sc.com': 'https://www.sc.com/favicon.ico',
  
  // 花旗銀行 (台灣已併入星展)
  'www.citibank.com.tw': 'https://www.citibank.com.tw/favicon.ico',
  'citibank.com.tw': 'https://www.citibank.com.tw/favicon.ico',
  
  // 星展銀行
  'www.dbs.com.tw': 'https://www.dbs.com.tw/favicon.ico',
  'dbs.com.tw': 'https://www.dbs.com.tw/favicon.ico',
  
  // 滙豐銀行
  'www.hsbc.com.tw': 'https://www.hsbc.com.tw/favicon.ico',
  'hsbc.com.tw': 'https://www.hsbc.com.tw/favicon.ico',
  
  // 凱基銀行
  'www.kgibank.com': 'https://www.kgibank.com/favicon.ico',
  'kgibank.com': 'https://www.kgibank.com/favicon.ico',
  
  // 王道銀行
  'www.Obank.com.tw': 'https://www.obank.com.tw/favicon.ico',
  'obank.com.tw': 'https://www.obank.com.tw/favicon.ico',
  
  // 遠東商銀
  'www.feib.com.tw': 'https://www.feib.com.tw/favicon.ico',
  'feib.com.tw': 'https://www.feib.com.tw/favicon.ico',
  
  // 元大銀行
  'www.yuanta.com': 'https://www.yuanta.com/favicon.ico',
  'yuanta.com': 'https://www.yuanta.com/favicon.ico',
  
  // 台灣銀行
  'www.bot.com.tw': 'https://www.bot.com.tw/favicon.ico',
  'bot.com.tw': 'https://www.bot.com.tw/favicon.ico',
  
  // 高雄銀行
  'www.bok.com.tw': 'https://www.bok.com.tw/favicon.ico',
  'bok.com.tw': 'https://www.bok.com.tw/favicon.ico',
  
  // 京城銀行
  'www.kingsbank.com.tw': 'https://www.kingsbank.com.tw/favicon.ico',
  'kingsbank.com.tw': 'https://www.kingsbank.com.tw/favicon.ico',
  
  // 安泰銀行
  'www.entiebank.com.tw': 'https://www.entiebank.com.tw/favicon.ico',
  'entiebank.com.tw': 'https://www.entiebank.com.tw/favicon.ico',
  
  // 陽信銀行
  'www.sunnybank.com.tw': 'https://www.sunnybank.com.tw/favicon.ico',
  'sunnybank.com.tw': 'https://www.sunnybank.com.tw/favicon.ico',
  
  // 板信銀行
  'www.bop.com.tw': 'https://www.bop.com.tw/favicon.ico',
  'bop.com.tw': 'https://www.bop.com.tw/favicon.ico',
  
  // 三信銀行
  'www.credit.com.tw': 'https://www.credit.com.tw/favicon.ico',
  'credit.com.tw': 'https://www.credit.com.tw/favicon.ico',
  
  // 聯邦銀行
  'www.ubot.com.tw': 'https://www.ubot.com.tw/favicon.ico',
  'ubot.com.tw': 'https://www.ubot.com.tw/favicon.ico',
  
  // 新光銀行
  'www.skbank.com.tw': 'https://www.skbank.com.tw/favicon.ico',
  'skbank.com.tw': 'https://www.skbank.com.tw/favicon.ico',
  
  // 日盛銀行 (已併入富邦)
  'www.jihsunbank.com.tw': 'https://www.jihsunbank.com.tw/favicon.ico',
  'jihsunbank.com.tw': 'https://www.jihsunbank.com.tw/favicon.ico',
  
  // 瑞興銀行
  'www.taipeistarbank.com.tw': 'https://www.taipeistarbank.com.tw/favicon.ico',
  'taipeistarbank.com.tw': 'https://www.taipeistarbank.com.tw/favicon.ico',
  
  // 華泰銀行
  'www.entrustbank.com.tw': 'https://www.entrustbank.com.tw/favicon.ico',
  'entrustbank.com.tw': 'https://www.entrustbank.com.tw/favicon.ico',
  
  // 台中銀行
  'www.tcbbank.com.tw': 'https://www.tcbbank.com.tw/favicon.ico',
  'tcbbank.com.tw': 'https://www.tcbbank.com.tw/favicon.ico',
  
  // 淡水一信
  'www.tcfcbank.com.tw': 'https://www.tcfcbank.com.tw/favicon.ico',
  'tcfcbank.com.tw': 'https://www.tcfcbank.com.tw/favicon.ico',
  
  // 大台北銀行
  'www.taipeibank.com.tw': 'https://www.taipeibank.com.tw/favicon.ico',
  'taipeibank.com.tw': 'https://www.taipeibank.com.tw/favicon.ico',
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
