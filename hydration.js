import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { auth, db, serverTimestamp } from "./firebase.js";

const welcomeText = document.getElementById("welcome-text");
const todayDate = document.getElementById("today-date");
const logoutBtn = document.getElementById("logout-btn");
const statusMessage = document.getElementById("status-message");
const waterForm = document.getElementById("water-form");
const waterAmountInput = document.getElementById("water-amount");
const waterTotal = document.getElementById("water-total");
const waterList = document.getElementById("water-list");
const waterGoalText = document.getElementById("water-goal-text");
const waterFill = document.getElementById("water-fill");
const waterProgressText = document.getElementById("water-progress-text");

let currentUser = null;
let currentDayKey = "";
let hydrationGoalMl = 2000;
const urlDateParam = new URLSearchParams(window.location.search).get("date");
const SELECTED_DATE_KEY_STORAGE = "nutri_selected_date";

function getDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getOrdinal(day) {
  return day > 3 && day < 21 ? "th" : ["th", "st", "nd", "rd"][day % 10] || "th";
}

function formatLongDate(d) {
  return `${d.toLocaleDateString(undefined, { weekday: "long" })} the ${d.getDate()}${getOrdinal(
    d.getDate()
  )} ${d.toLocaleDateString(undefined, { month: "long" })} ${d.getFullYear()}`;
}

function showMessage(message, type = "success") {
  statusMessage.textContent = message;
  statusMessage.classList.remove("error", "success");
  statusMessage.classList.add(type);
}

function hydrationCollection(uid) {
  return collection(db, "users", uid, "hydrationLogs");
}

async function refreshHydration() {
  const dateKey = currentDayKey;
  const q = query(hydrationCollection(currentUser.uid), where("dateKey", "==", dateKey));
  const snap = await getDocs(q);
  const entries = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const totalMl = entries.reduce((sum, e) => sum + (Number(e.amountMl) || 0), 0);
  waterTotal.textContent = `${(totalMl / 1000).toFixed(1)} L`;
  const safeGoalMl = Math.max(1, Number(hydrationGoalMl) || 2000);
  waterGoalText.textContent = `Goal: ${(safeGoalMl / 1000).toFixed(1)} L`;
  const progressPercent = Math.min(100, Math.max(0, Math.round((totalMl / safeGoalMl) * 100)));
  waterFill.style.height = `${progressPercent}%`;
  waterProgressText.textContent = `${progressPercent}% of daily goal`;

  if (!entries.length) {
    waterList.innerHTML = "<li><span>No hydration entries yet for this date.</span></li>";
    return;
  }
  waterList.innerHTML = entries
    .map(
      (e) =>
        `<li><span>${(Number(e.amountMl) / 1000).toFixed(2)} L</span><strong>${e.dateKey}</strong><button class="delete-btn" data-id="${e.id}" type="button">Delete</button></li>`
    )
    .join("");
}

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "./index.html";
});

waterForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const amountLitres = Number(waterAmountInput.value);
  if (!currentDayKey || !Number.isFinite(amountLitres) || amountLitres <= 0 || amountLitres > 20) {
    showMessage("Please enter a valid hydration amount.", "error");
    return;
  }
  const amountMl = Math.round(amountLitres * 1000);
  try {
    await addDoc(hydrationCollection(currentUser.uid), {
      amountMl,
      dateKey: currentDayKey,
      createdAt: serverTimestamp(),
    });
    waterAmountInput.value = "";
    showMessage("Hydration entry saved.");
    await refreshHydration();
  } catch (error) {
    showMessage(error.message, "error");
  }
});

waterList.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }
  const id = target.dataset.id;
  if (!id) {
    return;
  }
  try {
    await deleteDoc(doc(db, "users", currentUser.uid, "hydrationLogs", id));
    showMessage("Entry deleted.");
    await refreshHydration();
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
  currentDayKey = urlDateParam || localStorage.getItem(SELECTED_DATE_KEY_STORAGE) || getDateKey(today);
  localStorage.setItem(SELECTED_DATE_KEY_STORAGE, currentDayKey);
  todayDate.textContent = formatLongDate(new Date(`${currentDayKey}T00:00:00`));

  const profileSnap = await getDoc(doc(db, "users", user.uid));
  const profile = profileSnap.exists() ? profileSnap.data() : {};
  const displayName = profile.firstName ? `${profile.firstName} ${profile.lastName || ""}`.trim() : user.email.split("@")[0];
  welcomeText.textContent = `Signed in as ${displayName}`;

  const settingsRef = doc(db, "users", user.uid, "settings", "preferences");
  const settingsSnap = await getDoc(settingsRef);
  if (!settingsSnap.exists()) {
    await setDoc(settingsRef, { hydrationGoalMl: 2000, updatedAt: serverTimestamp() }, { merge: true });
    hydrationGoalMl = 2000;
  } else {
    hydrationGoalMl = Number(settingsSnap.data()?.hydrationGoalMl) || 2000;
  }
  await refreshHydration();
});

setInterval(() => {
  if (!currentUser) {
    return;
  }
  const now = new Date();
  const newDayKey = getDateKey(now);
  const pinnedDate = localStorage.getItem(SELECTED_DATE_KEY_STORAGE) || currentDayKey;
  if (newDayKey === currentDayKey || pinnedDate !== currentDayKey) {
    return;
  }
  currentDayKey = newDayKey;
  todayDate.textContent = formatLongDate(now);
  refreshHydration().catch((error) => showMessage(error.message, "error"));
}, 60000);
