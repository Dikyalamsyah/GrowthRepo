// script.js (module)
// Pesanan Growth Repo - Realtime dengan Firebase Firestore + Operator

// ====== IMPORT FIREBASE DARI CDN ======
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// ====== KONFIGURASI FIREBASE (PUNYA ANDA) ======
const firebaseConfig = {
  apiKey: "AIzaSyCRi4L6o8vnFiiRBWSLA8t1iuhqR44linQ",
  authDomain: "growth-repo-todo.firebaseapp.com",
  projectId: "growth-repo-todo",
  storageBucket: "growth-repo-todo.firebasestorage.app",
  messagingSenderId: "554593907556",
  appId: "1:554593907556:web:c1d3411f72c535d4eac071",
};

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const todosCol = collection(db, "todos"); // nama koleksi: "todos"

const MONTH_NAMES_ID = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

// ====== DOM ELEMENTS ======
const todoForm = document.getElementById("todo-form");
const taskInput = document.getElementById("task-input");
const dateInput = document.getElementById("date-input");
const operatorInput = document.getElementById("operator-input");
const formError = document.getElementById("form-error");

const statusFilterSelect = document.getElementById("status-filter");
const operatorFilterSelect = document.getElementById("operator-filter");
const clearAllBtn = document.getElementById("clear-all-btn");

const tableBody = document.getElementById("todo-table-body");
const emptyMessage = document.getElementById("empty-message");

const totalCountEl = document.getElementById("total-count");
const completedCountEl = document.getElementById("completed-count");
const pendingCountEl = document.getElementById("pending-count");

// State lokal (mirror dari Firestore)
let todos = [];

// ====== UTIL: TANGGAL OTOMATIS DI INPUT ======
function setDefaultDateTimeNow() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");

  // nilai asli (untuk disimpan ke Firestore, format ISO)
  const isoValue = `${year}-${month}-${day}T${hours}:${minutes}`;

  // nilai tampilan lebih enak dibaca
  const monthLabel = MONTH_NAMES_ID[now.getMonth()];
  const displayValue = `${day} ${monthLabel} ${year}, ${hours}.${minutes}`;

  // simpan ISO di data-* dan tampilkan yang cantik di input
  dateInput.dataset.raw = isoValue;
  dateInput.value = displayValue;
}

// ====== UTIL: FORMAT TANGGAL UNTUK TAMPILAN TABLE ======
function splitDateTimeForDisplay(dateString) {
  if (!dateString) {
    return { displayDate: "-", displayTime: "" };
  }

  // format bawaan datetime-local: YYYY-MM-DDTHH:MM
  const [datePart, timePart] = dateString.split("T");
  if (!timePart) {
    return { displayDate: dateString, displayTime: "" };
  }

  const [year, month, day] = datePart.split("-");
  const displayDate = `${day}-${month}-${year}`;
  const displayTime = timePart;

  return { displayDate, displayTime };
}

// ====== VALIDASI FORM ======
function validateForm(task, date, operator) {
  if (!task && !date && !operator) {
    formError.textContent =
      "Nama & NO. Pesanan, tanggal, dan operator wajib diisi.";
    return false;
  }

  if (!task) {
    formError.textContent = "Nama & NO. Pesanan tidak boleh kosong.";
    return false;
  }

  if (!date) {
    formError.textContent = "Tanggal pesanan tidak boleh kosong.";
    return false;
  }

  if (!operator) {
    formError.textContent = "Editor wajib dipilih.";
    return false;
  }

  formError.textContent = "";
  return true;
}

// ====== CRUD: FIRESTORE ======

// Tambah pesanan ke Firestore
async function addTodo(task, date, operator) {
  try {
    await addDoc(todosCol, {
      title: task,
      date: date,
      operator: operator,
      completed: false,
      createdAt: serverTimestamp(),
    });
    // Tidak perlu render manual; onSnapshot akan jalan otomatis
  } catch (err) {
    console.error("Gagal menambah pesanan:", err);
    alert("Terjadi kesalahan saat menyimpan pesanan.");
  }
}

// Hapus satu pesanan
async function deleteTodo(id) {
  try {
    await deleteDoc(doc(db, "todos", id));
  } catch (err) {
    console.error("Gagal menghapus pesanan:", err);
    alert("Terjadi kesalahan saat menghapus pesanan.");
  }
}

// Toggle selesai/belum selesai
async function toggleTodo(id) {
  const todo = todos.find((t) => t.id === id);
  if (!todo) return;

  try {
    await updateDoc(doc(db, "todos", id), {
      completed: !todo.completed,
    });
  } catch (err) {
    console.error("Gagal mengubah status pesanan:", err);
    alert("Terjadi kesalahan saat mengubah status pesanan.");
  }
}

// ====== STATISTIK ======
function updateStats() {
  const total = todos.length;
  const completed = todos.filter((todo) => todo.completed).length;
  const pending = total - completed;

  totalCountEl.textContent = total;
  completedCountEl.textContent = completed;
  pendingCountEl.textContent = pending;
}

// ====== RENDER TABLE DARI STATE `todos` ======
function renderTodos() {
  const statusFilter = statusFilterSelect.value;   // all | pending | completed
  const operatorFilter = operatorFilterSelect.value; // all | Diky | Noval | dst

  const filteredTodos = todos.filter((todo) => {
    // filter status
    if (statusFilter === "completed" && !todo.completed) return false;
    if (statusFilter === "pending" && todo.completed) return false;

    // filter operator
    if (operatorFilter !== "all" && todo.operator !== operatorFilter) {
      return false;
    }

    return true;
  });

  tableBody.innerHTML = "";

  if (filteredTodos.length === 0) {
    emptyMessage.style.display = "block";
  } else {
    emptyMessage.style.display = "none";
  }

  filteredTodos.forEach((todo) => {
    const tr = document.createElement("tr");
    if (todo.completed) {
      tr.classList.add("completed");
    }

    // Nama & No Pesanan
    const titleTd = document.createElement("td");
    titleTd.textContent = todo.title;

    // Tanggal (tgl di atas, jam di bawah)
    const dateTd = document.createElement("td");
    const { displayDate, displayTime } = splitDateTimeForDisplay(todo.date);
    const dateLine = document.createElement("div");
    dateLine.textContent = displayDate;
    dateTd.appendChild(dateLine);

    if (displayTime) {
      const timeLine = document.createElement("div");
      timeLine.textContent = displayTime;
      timeLine.classList.add("time-text");
      dateTd.appendChild(timeLine);
    }

    // Operator
    const operatorTd = document.createElement("td");
    operatorTd.textContent = todo.operator || "-";

    // Status
    const statusTd = document.createElement("td");
    statusTd.classList.add("status-cell");
    const statusSpan = document.createElement("span");
    statusSpan.classList.add(
      "status-pill",
      todo.completed ? "completed" : "pending"
    );
    statusSpan.textContent = todo.completed ? "Selesai" : "Belum selesai";
    statusTd.appendChild(statusSpan);

    // Aksi
    const actionsTd = document.createElement("td");
    actionsTd.classList.add("action-buttons");

    const toggleBtn = document.createElement("button");
    toggleBtn.className = "btn secondary btn-toggle";
    toggleBtn.textContent = todo.completed
      ? "Tandai Belum"
      : "Tandai Selesai";
    toggleBtn.dataset.id = todo.id;

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn danger btn-delete";
    deleteBtn.textContent = "Hapus";
    deleteBtn.dataset.id = todo.id;

    actionsTd.appendChild(toggleBtn);
    actionsTd.appendChild(deleteBtn);

    tr.appendChild(titleTd);
    tr.appendChild(dateTd);
    tr.appendChild(operatorTd);
    tr.appendChild(statusTd);
    tr.appendChild(actionsTd);

    tableBody.appendChild(tr);
  });

  updateStats();
}

// ====== LISTENER REALTIME DARI FIRESTORE ======
function subscribeTodosRealtime() {
  const q = query(todosCol, orderBy("createdAt", "asc"));

  onSnapshot(
    q,
    (snapshot) => {
      todos = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      renderTodos();
    },
    (error) => {
      console.error("Error listening todos:", error);
    }
  );
}

// ====== EVENT HANDLERS ======

// Submit form
todoForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const task = taskInput.value.trim();
  const rawDate = dateInput.dataset.raw || ""; // pakai nilai ISO
  const operator = operatorInput.value;

  const isValid = validateForm(task, rawDate, operator);
  if (!isValid) return;

  addTodo(task, rawDate, operator);

  todoForm.reset();
  setDefaultDateTimeNow();
});


// Filter status
statusFilterSelect.addEventListener("change", () => {
  renderTodos();
});

// Filter operator
operatorFilterSelect.addEventListener("change", () => {
  renderTodos();
});

// Hapus semua
clearAllBtn.addEventListener("click", async () => {
  if (todos.length === 0) return;

  const yakin = window.confirm("Yakin ingin menghapus semua pesanan?");
  if (!yakin) return;

  // Hapus semua dokumen satu per satu
  for (const todo of todos) {
    await deleteTodo(todo.id);
  }
});

// Delegasi tombol di tabel
tableBody.addEventListener("click", (event) => {
  const target = event.target;

  if (target.matches(".btn-delete")) {
    const id = target.dataset.id;
    deleteTodo(id);
  }

  if (target.matches(".btn-toggle")) {
    const id = target.dataset.id;
    toggleTodo(id);
  }
});

// ====== INIT ======
setDefaultDateTimeNow();
subscribeTodosRealtime();
