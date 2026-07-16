function extractDownfallIndex(title) {
  const normalizedTitle = title.replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xfee0));
  const numberPattern = "([0-9]+(?:\\.[0-9]+)?)";
  const formatIndex = (value) => Number(value).toFixed(2);
  const movementUnits = "飆至|飙至|升至|漲至|涨至|達到|达到|衝到|冲到|升到|達|达|突破|破|到|至";
  const isPlausibleIndex = (raw, nextText = "") => {
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 1 || value > 100) return false;
    if (/^[月日號号年]/.test(nextText)) return false;
    if (value >= 40) return true;
    return raw.includes(".");
  };

  const movementNearLabel = normalizedTitle.match(
    new RegExp(`倒台指[數数][」』"']?.{0,40}?(?:${movementUnits})\\s*${numberPattern}`)
  );
  if (movementNearLabel?.[1]) {
    const full = movementNearLabel[0];
    const num = movementNearLabel[1];
    const nextText = full.slice(full.lastIndexOf(num) + num.length);
    if (isPlausibleIndex(num, nextText)) return formatIndex(num);
  }

  const indexAfterLabel = normalizedTitle.match(
    new RegExp(`倒台指[數数][」』"']?\\s*${numberPattern}(?![月日號号年])`)
  );
  if (indexAfterLabel?.[1] && isPlausibleIndex(indexAfterLabel[1])) return formatIndex(indexAfterLabel[1]);
  return "";
}

const titles = [
  "本月「倒台指數」再度上行：社保擠壓收入",
  "中共倒台指數6月飆至70.58，漲幅近前月兩倍",
  "2026年1月「倒台指數」衝到69.39：經濟三駕馬車",
  "中國政權進入高危震蕩期！「倒台指數」11月飆至68.28，萬科暴雷",
  "解讀「中共倒台指數」67！對比伊朗",
  "中共倒台指數 5 月飆至 70.43！跨 11 省",
  "中共倒台指數飆升至69.79！伊朗被滅",
  "2026年4月中共倒台指數升至70.35！能源",
  "中共倒台指數飆至68.51 日企大撤離",
];

for (const t of titles) console.log((extractDownfallIndex(t) || "(known/map)").padEnd(10), t.slice(0, 40));
