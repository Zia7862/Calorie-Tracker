import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { addDoc, collection, doc, getDocs, query, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { auth, db, serverTimestamp } from "./firebase.js";

const welcomeText = document.getElementById("welcome-text");
const todayDate = document.getElementById("today-date");
const logoutBtn = document.getElementById("logout-btn");
const statusMessage = document.getElementById("status-message");
const goalForm = document.getElementById("goal-form");
const goalDateInput = document.getElementById("goal-date");
const goalCaloriesInput = document.getElementById("goal-calories");
const weightForm = document.getElementById("weight-form");
const weightDateInput = document.getElementById("weight-date");
const weightValueInput = document.getElementById("weight-value");
const weightList = document.getElementById("weight-list");

let currentUser = null;

const getDateKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const getOrdinal = (day) => (day > 3 && day < 21 ? "th" : ["th", "st", "nd", "rd"][day % 10] || "th");
const formatLongDate = (d) =>
  `${d.toLocaleDateString(undefined, { weekday: "long" })} the ${d.getDate()}${getOrdinal(d.getDate())} ${d.toLocaleDateString(undefined, { month: "long" })} ${d.getFullYear()}`;

function showMessage(message, type = "success") {
  statusMessage.textContent = message;
  statusMessage.classList.remove("error", "success");
  statusMessage.classList.add(type);
}

async function refreshWeights() {
  const snap = await getDocs(query(collection(db, "users", currentUser.uid, "weightLogs")));
  const rows = snap.docs.map((d) => d.data()).sort((a, b) => (a.dateKey > b.dateKey ? -1 : 1));
  if (!rows.length) {
    weightList.innerHTML = "<li><span>No weight entries yet.</span></li>";
    return;
  }
  weightList.innerHTML = rows.map((w) => `<li><span>${w.dateKey}</span><strong>${Number(w.weight).toFixed(1)} kg</strong></li>`).join("");
}

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "./index.html";
});

goalForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const calories = Number(goalCaloriesInput.value);
  if (!goalDateInput.value || !Number.isFinite(calories) || calories <= 0) {
    showMessage("Please enter a valid calorie goal.", "error");
    return;
  }
  try {
    await setDoc(doc(db, "users", currentUser.uid, "dailyGoals", goalDateInput.value), {
      calories,
      updatedAt: serverTimestamp(),
    });
    showMessage("Daily goal saved.");
  } catch (error) {
    showMessage(error.message, "error");
  }
});

weightForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const weight = Number(weightValueInput.value);
  if (!weightDateInput.value || !Number.isFinite(weight) || weight <= 0) {
    showMessage("Please enter a valid weight.", "error");
    return;
  }
  try {
    await addDoc(collection(db, "users", currentUser.uid, "weightLogs"), {
      dateKey: weightDateInput.value,
      weight,
      createdAt: serverTimestamp(),
    });
    weightValueInput.value = "";
    showMessage("Weight saved.");
    await refreshWeights();
  } catch (error) {
    showMessage(error.message, "error");
  }
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "./index.html";
    return;
  }
  currentUser = user;
  const today = new Date();
  todayDate.textContent = formatLongDate(today);
  const dateKey = getDateKey(today);
  goalDateInput.value = dateKey;
  weightDateInput.value = dateKey;
  welcomeText.textContent = `Signed in as ${user.email.split("@")[0]}`;
  await refreshWeights();
});
