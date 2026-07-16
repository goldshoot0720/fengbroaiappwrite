const fs = require("fs");
const path = require("path");

// Investing.com daily closes 2026-06-16 to 2026-07-16
const month = [
  { d: "06/16", c: 8726.6 },
  { d: "06/17", c: 8864.24 },
  { d: "06/18", c: 9063.84 },
  { d: "06/19", c: 9052.42 },
  { d: "06/22", c: 9114.55 },
  { d: "06/23", c: 8203.84 },
  { d: "06/24", c: 8471.02 },
  { d: "06/25", c: 8930.3 },
  { d: "06/26", c: 8411.21 },
  { d: "06/29", c: 8394.65 },
  { d: "06/30", c: 8476.48 },
  { d: "07/01", c: 8303.41 },
  { d: "07/02", c: 7648.09 },
  { d: "07/03", c: 8088.34 },
  { d: "07/06", c: 8051.33 },
  { d: "07/07", c: 7656.31 },
  { d: "07/08", c: 7246.79 },
  { d: "07/09", c: 7291.91 },
  { d: "07/10", c: 7475.94 },
  { d: "07/13", c: 6806.93 },
  { d: "07/14", c: 6856.83 },
  { d: "07/15", c: 7284.41 },
  { d: "07/16", c: 6820.6 },
];

const weekData = [
  { d: "07/09", c: 7291.91 },
  { d: "07/10", c: 7475.94 },
  { d: "07/13", c: 6806.93 },
  { d: "07/14", c: 6856.83 },
  { d: "07/15", c: 7284.41 },
  { d: "07/16", c: 6820.6 },
];

function fmt(n) {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function chartSVG(data, title, subtitle, filename, width, height) {
  const ml = 80;
  const mr = 40;
  const mt = 80;
  const mb = 70;
  const pw = width - ml - mr;
  const ph = height - mt - mb;
  const closes = data.map((x) => x.c);
  const min = Math.min(...closes) * 0.98;
  const max = Math.max(...closes) * 1.02;
  const first = closes[0];
  const last = closes[closes.length - 1];
  const chg = ((last - first) / first) * 100;
  const up = chg >= 0;
  const lineColor = up ? "#16a34a" : "#dc2626";
  const fillColor = up ? "rgba(22,163,74,0.12)" : "rgba(220,38,38,0.12)";

  const x = (i) => ml + (i / (data.length - 1)) * pw;
  const y = (v) => mt + (1 - (v - min) / (max - min)) * ph;

  const pts = data
    .map((p, i) => x(i).toFixed(1) + "," + y(p.c).toFixed(1))
    .join(" ");
  const area =
    x(0).toFixed(1) +
    "," +
    (mt + ph).toFixed(1) +
    " " +
    pts +
    " " +
    x(data.length - 1).toFixed(1) +
    "," +
    (mt + ph).toFixed(1);

  let grids = "";
  let labels = "";
  const yTicks = 5;
  for (let i = 0; i <= yTicks; i++) {
    const v = min + ((max - min) * i) / yTicks;
    const yy = y(v);
    grids +=
      "<line x1='" +
      ml +
      "' y1='" +
      yy.toFixed(1) +
      "' x2='" +
      (width - mr) +
      "' y2='" +
      yy.toFixed(1) +
      "' stroke='#e5e7eb' stroke-width='1'/>";
    labels +=
      "<text x='" +
      (ml - 12) +
      "' y='" +
      (yy + 4).toFixed(1) +
      "' text-anchor='end' font-family='Segoe UI,Arial,sans-serif' font-size='12' fill='#6b7280'>" +
      Math.round(v) +
      "</text>";
  }

  let xlabels = "";
  const step = Math.max(1, Math.floor((data.length - 1) / 6));
  data.forEach((p, i) => {
    if (i % step === 0 || i === data.length - 1) {
      xlabels +=
        "<text x='" +
        x(i).toFixed(1) +
        "' y='" +
        (height - mb + 28) +
        "' text-anchor='middle' font-family='Segoe UI,Arial,sans-serif' font-size='12' fill='#6b7280'>" +
        p.d +
        "</text>";
    }
  });

  let markers = "";
  data.forEach((p, i) => {
    markers +=
      "<circle cx='" +
      x(i).toFixed(1) +
      "' cy='" +
      y(p.c).toFixed(1) +
      "' r='4' fill='" +
      lineColor +
      "' stroke='white' stroke-width='1.5'/>";
  });

  const endLabel =
    "<text x='" +
    (x(data.length - 1) - 8).toFixed(1) +
    "' y='" +
    (y(last) - 14).toFixed(1) +
    "' text-anchor='end' font-family='Segoe UI,Arial,sans-serif' font-size='13' font-weight='600' fill='" +
    lineColor +
    "'>" +
    fmt(last) +
    "</text>";

  const chgStr = (chg >= 0 ? "+" : "") + chg.toFixed(2) + "%";

  const svg =
    "<?xml version='1.0' encoding='UTF-8'?>\n" +
    "<svg xmlns='http://www.w3.org/2000/svg' width='" +
    width +
    "' height='" +
    height +
    "' viewBox='0 0 " +
    width +
    " " +
    height +
    "'>\n" +
    "  <rect width='100%' height='100%' fill='#ffffff'/>\n" +
    "  <text x='" +
    ml +
    "' y='36' font-family='Segoe UI,Arial,sans-serif' font-size='22' font-weight='700' fill='#111827'>" +
    title +
    "</text>\n" +
    "  <text x='" +
    ml +
    "' y='58' font-family='Segoe UI,Arial,sans-serif' font-size='14' fill='#6b7280'>" +
    subtitle +
    "</text>\n" +
    "  <text x='" +
    (width - mr) +
    "' y='36' text-anchor='end' font-family='Segoe UI,Arial,sans-serif' font-size='20' font-weight='700' fill='" +
    lineColor +
    "'>" +
    chgStr +
    "</text>\n" +
    "  <text x='" +
    (width - mr) +
    "' y='58' text-anchor='end' font-family='Segoe UI,Arial,sans-serif' font-size='13' fill='#6b7280'>" +
    fmt(first) +
    " → " +
    fmt(last) +
    "</text>\n" +
    "  " +
    grids +
    "\n  " +
    labels +
    "\n" +
    "  <polygon points='" +
    area +
    "' fill='" +
    fillColor +
    "'/>\n" +
    "  <polyline points='" +
    pts +
    "' fill='none' stroke='" +
    lineColor +
    "' stroke-width='3' stroke-linejoin='round' stroke-linecap='round'/>\n" +
    "  " +
    markers +
    "\n  " +
    endLabel +
    "\n  " +
    xlabels +
    "\n" +
    "  <text x='" +
    width / 2 +
    "' y='" +
    (height - 18) +
    "' text-anchor='middle' font-family='Segoe UI,Arial,sans-serif' font-size='11' fill='#9ca3af'>Source: Investing.com daily closes · as of 2026-07-16</text>\n" +
    "</svg>\n";

  fs.writeFileSync(filename, svg);
  console.log("wrote", filename, "chg", chgStr);
}

const outDir = path.join(__dirname, "..");
chartSVG(
  month,
  "KOSPI Index — 最近一個月",
  "2026/06/16 – 2026/07/16  ·  日收盤",
  path.join(outDir, "kospi_1m_chart.svg"),
  1100,
  620
);
chartSVG(
  weekData,
  "KOSPI Index — 最近一周",
  "2026/07/09 – 2026/07/16  ·  日收盤",
  path.join(outDir, "kospi_1w_chart.svg"),
  1000,
  560
);
console.log("done");
