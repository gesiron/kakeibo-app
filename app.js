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

const form = document.getElementById("expenseForm");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const date = document.getElementById("date").value;
  const type = document.getElementById("type").value;
  const category = document.getElementById("category").value;
  const amount = parseInt(document.getElementById("amount").value);
  await addDoc(collection(db, "expenses"), { date, type, category, amount });
  loadExpenses();
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
  dataList = [];   // ← 空にする
} else {
  dataList = monthlyData[month] || [];
}

  let total = 0;
  dataList.forEach(data => {
    const div = document.createElement("div");
    div.textContent = `${data.date} | ${data.type} | ${data.category} | ${data.amount}円`;
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
    { id: "chart-electric", label: "電気", category: "電気", color: "orange", recordOnly: false },
    { id: "chart-kochi", label: "こち", category: "こち", color: "olive", recordOnly: true },
    { id: "chart-water", label: "水道", category: "水道", color: "dodgerblue", recordOnly: true }
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
  const savingTotals = months.map(m => sumBy(m, d => d.type === "記録" && d.category === "貯金合計"));

  const chartDefs = [
    { id: "chart-balance", label: "収支（収入−支出）", data: balanceTotals, color: "black", title: "収支の月次推移" },
    { id: "chart-expense", label: "支出合計", data: expenseTotals, color: "darkgray", title: "支出の月次推移" },
    { id: "chart-side", label: "副収入推移", data: sideTotals, color: "green", title: "副収入の月次推移" },
    { id: "chart-saving", label: "貯金合計", data: savingTotals, color: "blue", title: "貯金合計の月次推移" }
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
}      // ← drawCharts の閉じ括弧

// アプリ起動時にデータ読み込み
loadExpenses();
