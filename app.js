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
}

function showMonthData(month, monthlyData) {
  const container = document.getElementById("monthData");
  container.innerHTML = "";

  let dataList = [];
  if (month === "all") {
    Object.values(monthlyData).forEach(arr => dataList.push(...arr));
    dataList = dataList.filter(d => d.type === "記録"); // ← 履歴完全非表示
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

  const categories = [
    { id: "chart-card", label: "カード", category: "カード", color: "red" },
    { id: "chart-cash", label: "現金", category: "現金", color: "brown" },
    { id: "chart-insurance", label: "保険", category: "保険", color: "purple" },
    { id: "chart-loan", label: "住宅ローン", category: "住宅ローン", color: "teal" },
    { id: "chart-water", label: "水道", category: "水道", color: "dodgerblue" },
    { id: "chart-kochi", label: "こち", category: "こち", color: "olive" },
    { id: "chart-electric", label: "電気", category: "電気", color: "orange" } // ← 電気グラフ追加
  ];

  categories.forEach(({ id, label, category, color }) => {
    const totals = months.map(m => sumBy(m, d => d.type === "記録" && d.category === category));
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
          title: { display: true, text: `${label}の月次推移`, font: { size: 39 } },
          legend: { labels: { font: { size: 30 } } }
        },
        scales: {
          x: { ticks: { font: { size: 27 } } },
          y: { ticks: { font: { size: 27 } } }
        }
      }
    });
  });  const balanceTotals = months.map(m => {
    const income = sumBy(m, d => d.type === "収入");
    const expense = sumBy(m, d => d.type === "支出");
    return income - expense;
  });

  if (chartInstances["chart-balance"]) chartInstances["chart-balance"].destroy();
  const ctxBalance = document.getElementById("chart-balance").getContext("2d");
  chartInstances["chart-balance"] = new Chart(ctxBalance, {
    type: "line",
    data: {
      labels: months,
      datasets: [{ label: "収支（収入−支出）", data: balanceTotals, borderColor: "black", fill: false }]
    },
    options: {
      responsive: true,
      plugins: {
        title: { display: true, text: "収支の月次推移", font: { size: 39 } },
        legend: { labels: { font: { size: 30 } } }
      },
      scales: {
        x: { ticks: { font: { size: 27 } } },
        y: { ticks: { font: { size: 27 } } }
      }
    }
  });

  const expenseTotals = months.map(m => sumBy(m, d => d.type === "支出"));
  if (chartInstances["chart-expense"]) chartInstances["chart-expense"].destroy();
  const ctxExpense = document.getElementById("chart-expense").getContext("2d");
  chartInstances["chart-expense"] = new Chart(ctxExpense, {
    type: "line",
    data: {
      labels: months,
      datasets: [{ label: "支出合計", data: expenseTotals, borderColor: "darkgray", fill: false }]
    },
    options: {
      responsive: true,
      plugins: {
        title: { display: true, text: "支出の月次推移", font: { size: 39 } },
        legend: { labels: { font: { size: 30 } } }
      },
      scales: {
        x: { ticks: { font: { size: 27 } } },
        y: { ticks: { font: { size: 27 } } }
      }
    }
  });

  const sideTotals = months.map(m => sumBy(m, d => d.type === "記録" && d.category === "副収入"));
  if (chartInstances["chart-side"]) chartInstances["chart-side"].destroy();
  const ctxSide = document.getElementById("chart-side").getContext("2d");
  chartInstances["chart-side"] = new Chart(ctxSide, {
    type: "line",
    data: {
      labels: months,
      datasets: [{ label: "副収入推移", data: sideTotals, borderColor: "green", fill: false }]
    },
    options: {
      responsive: true,
      plugins: {
        title: { display: true, text: "副収入の月次推移", font: { size: 39 } },
        legend: { labels: { font: { size: 30 } } }
      },
      scales: {
        x: { ticks: { font: { size: 27 } } },
        y: { min: 0, ticks: { font: { size: 27 } } }
      }
    }
  });

  const savingTotals = months.map(m => sumBy(m, d => d.type === "記録" && d.category === "貯金合計"));
  if (chartInstances["chart-saving"]) chartInstances["chart-saving"].destroy();
  const ctxSaving = document.getElementById("chart-saving").getContext("2d");
  chartInstances["chart-saving"] = new Chart(ctxSaving, {
    type: "line",
    data: {
      labels: months,
      datasets: [{ label: "貯金合計", data: savingTotals, borderColor: "blue", fill: false }]
    },
    options: {
      responsive: true,
      plugins: {
        title: { display: true, text: "貯金合計の月次推移", font: { size: 39 } },
        legend: { labels: { font: { size: 30 } } }
      },
      scales: {
        x: { ticks: { font: { size: 27 } } },
        y: { min: 0, ticks: { font: { size: 27 } } }
      }
    }
  });
} // ← drawCharts 関数の閉じ

loadExpenses(); // ← アプリ起動時に読み込み