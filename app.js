import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBnv0rwEtAxAUJea3uf2hGyrRLfBDLUZQ",
  authDomain: "kakeibo-7b6c3.firebaseapp.com",
  projectId: "kakeibo-7b6c3",
  storageBucket: "kakeibo-7b6c3.appspot.com",
  messagingSenderId: "1271275571588",
  appId: "1:1271275571588:web:ebb87469b21c26754352ed1",
  measurementId: "G-6V1N3SJST"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ★ ここに追加する
const typeMap = {
  "カード": "支出",
  "現金": "支出",
  "保険": "支出",
  "住宅ローン": "支出",
  "タバコ": "記録",
  "電気": "記録",
  "水道": "記録",
  "こち": "記録",
  "副収入": "記録",
  "貯金合計": "記録",
  "給料": "収入",
  "太陽光発電": "収入",
  "NISA利益": "記録",
};


const form = document.getElementById("expenseForm");
form.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();  // ★ Enter で送信されるのを止める
  }
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const date = document.getElementById("date").value;
  const category = document.getElementById("category").value;  // ★ 先に category を取る
  const type = typeMap[category];  // ★ その後で type を決める
  const amount = parseInt(document.getElementById("amount").value);
  const memo = document.getElementById("memo").value;

  await addDoc(collection(db, "expenses"), { date, type, category, amount, memo });
});

async function loadExpenses() {
  const snapshot = await getDocs(collection(db, "expenses"));
  let monthlyData = {};
  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const month = data.date.slice(0, 7);
    if (!monthlyData[month]) monthlyData[month] = [];
    monthlyData[month].push({ id: docSnap.id, ...data });
  });

  const tabs = document.getElementById("monthTabs");
  tabs.innerHTML = "";

  const allTab = document.createElement("button");
  allTab.textContent = "全体";
  allTab.onclick = () => showMonthData("all", monthlyData);
  tabs.appendChild(allTab);

  Object.keys(monthlyData).sort().forEach(month => {
    const btn = document.createElement("button");
    btn.textContent = month;
    btn.onclick = () => showMonthData(month, monthlyData);
    tabs.appendChild(btn);
  });

  showMonthData("all", monthlyData);
}function showMonthData(month, monthlyData) {
  const container = document.getElementById("monthData");
  container.innerHTML = "";

 let dataList = [];
if (month === "all") {
  // 全体では一覧を表示しない
  dataList = [];
} else {
  dataList = monthlyData[month] || [];

  // ★ 2025-11 など「その月の中」を日付昇順に並べる
  dataList.sort((a, b) => a.date.localeCompare(b.date));
}

  let total = 0;
  dataList.forEach(data => {
    const div = document.createElement("div");
   div.textContent = `${data.date} | ${data.type} | ${data.category} | ${data.amount}円` +
                  (data.memo ? ` | メモ: ${data.memo}` : "");
    const delBtn = document.createElement("button");
    delBtn.textContent = "削除";
    delBtn.onclick = async () => {
      const ok = confirm("この記録を削除してもよろしいですか？");
      if (!ok) return;
      await deleteDoc(doc(db, "expenses", data.id));
      loadExpenses();
    };
    div.appendChild(delBtn);
    container.appendChild(div);

    if (data.type === "収入") total += data.amount;
    else if (data.type === "支出") total -= data.amount;
  });

  const summary = document.createElement("div");
  summary.textContent = `${month === "all" ? "全体" : month} の収支合計: ${total}円`;
  container.appendChild(summary);

  if (month === "all") {
    document.getElementById("charts").style.display = "block";
    drawCharts(monthlyData);
  } else {
    document.getElementById("charts").style.display = "none";
  }
}

let chartInstances = {};

function drawCharts(monthlyData) {
  const months = Object.keys(monthlyData).sort();

  const sumBy = (month, predicate) =>
    monthlyData[month]
      .filter(predicate)
      .reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

  // ✅ PCとスマホでフォントサイズを切り替え
  const isMobile = window.innerWidth <= 600;
  const fontSizeX = isMobile ? 10 : 30;   // PCでは30px
  const fontSizeY = isMobile ? 10 : 30;
  const titleSize = isMobile ? 16 : 22;
  const legendSize = isMobile ? 12 : 16;

  // recordOnly=true は「記録専用カテゴリ」
 const categories = [
  { id: "chart-card", label: "カード", category: "カード", color: "red", recordOnly: false },
  { id: "chart-cash", label: "現金", category: "現金", color: "brown", recordOnly: false },
  { id: "chart-insurance", label: "保険", category: "保険", color: "purple", recordOnly: false },
  { id: "chart-loan", label: "住宅ローン", category: "住宅ローン", color: "teal", recordOnly: false },
  { id: "chart-electric", label: "電気", category: "電気", color: "orange", recordOnly: true },
  { id: "chart-kochi", label: "こち", category: "こち", color: "olive", recordOnly: true },
  { id: "chart-water", label: "水道", category: "水道", color: "dodgerblue", recordOnly: true },
  { id: "chart-tobacco", label: "タバコ", category: "タバコ", color: "gray", recordOnly: true } // ✅ ここを追加
];

  categories.forEach(({ id, label, category, color, recordOnly }) => {
    const predicate = recordOnly
      ? (d) => d.type === "記録" && d.category === category
      : (d) => d.category === category && d.type !== "記録";

    const totals = months.map(m => sumBy(m, predicate));

    if (chartInstances[id]) chartInstances[id].destroy();
    const ctx = document.getElementById(id).getContext("2d");
    chartInstances[id] = new Chart(ctx, {
      type: "line",
      data: {
        labels: months,
        datasets: [{ label, data: totals, borderColor: color, fill: false }]
      },
      options: {
        responsive: true,
        plugins: {
          title: { display: true, text: `${label}の月次推移`, font: { size: titleSize } },
          legend: { labels: { font: { size: legendSize } } }
        },
        scales: {
          x: {
            ticks: {
              font: { size: fontSizeX },   // ✅ PCでは大きく
              autoSkip: false,
              maxRotation: 90,
              minRotation: 45
            }
          },
          y: {
            beginAtZero: true,
            ticks: {
              font: { size: fontSizeY },   // ✅ PCでは大きく
              autoSkip: false,
              maxTicksLimit: 12
            }
          }
        }
      }
    });
  });

  const balanceTotals = months.map(m => sumBy(m, d => d.type === "収入") - sumBy(m, d => d.type === "支出"));
  const expenseTotals = months.map(m => sumBy(m, d => d.type === "支出"));
  const sideTotals = months.map(m => sumBy(m, d => d.type === "記録" && d.category === "副収入"));
 let lastValue = null;
const savingTotals = months.map(m => {
  const value = sumBy(m, d => d.type === "記録" && d.category === "貯金合計");
  if (value > 0) {
    lastValue = value;   // 入力がある月は更新
    return value;
  } else {
    return lastValue;    // 入力がない月は直前の値をコピー
  }
});
  // ✅ 太陽光発電収入の集計を追加
  const solarTotals = months.map(m => sumBy(m, d => d.type === "収入" && d.category === "太陽光発電"));
// ▼ NISA利益（毎月入力）
const nisaProfitTotals = months.map(m =>
  sumBy(m, d => d.category === "NISA利益")
);
  const chartDefs = [
    { id: "chart-balance", label: "収支（収入−支出）", data: balanceTotals, color: "black", title: "収支の月次推移" },
    { id: "chart-expense", label: "支出合計", data: expenseTotals, color: "darkgray", title: "支出の月次推移" },
    { id: "chart-side", label: "副収入推移", data: sideTotals, color: "green", title: "副収入の月次推移" },
    { id: "chart-saving", label: "貯金合計", data: savingTotals, color: "blue", title: "貯金合計の月次推移" },
    // ✅ 太陽光発電収入グラフを追加
    { id: "chart-solar", label: "太陽光発電収入", data: solarTotals, color: "gold", title: "太陽光発電収入の月次推移" },
    { id: "chart-nisa-profit", label: "NISA利益", data: nisaProfitTotals, color: "red", title: "NISA利益の月次推移" }
   ];

 chartDefs.forEach(({ id, label, data, color, title }) => {
  if (chartInstances[id]) chartInstances[id].destroy();
  new Chart(document.getElementById(id).getContext("2d"), {
    type: "line",
    data: { labels: months, datasets: [{ label, data, borderColor: color, fill: false }] },
    options: {
      responsive: true,
      plugins: {
        title: { display: true, text: title, font: { size: titleSize } },
        legend: { labels: { font: { size: legendSize } } }
      },
      scales: {
        x: {
          ticks: {
            font: { size: fontSizeX },
            autoSkip: false,
            maxRotation: 90,
            minRotation: 45
          }
        },
       y: {
  beginAtZero: false,   // ★ 0 から始めない
  suggestedMin: Math.min(...data) * 0.95,  // ★ 最小値を少し下げて設定
  ticks: {
    font: { size: fontSizeY },
    autoSkip: false,
    maxTicksLimit: 12
  },
  grid: {
    color: (ctx) => {
      if (ctx.tick.value === 0 && id === "chart-balance") {
        return "red";
      }
      return "#ccc";
    }
  }
}   }
    }
  });
}); // ← forEach の閉じ
}    // ← drawCharts の閉じ

// アプリ起動時にデータ読み込み
loadExpenses();
