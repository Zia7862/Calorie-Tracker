import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { auth, db, serverTimestamp } from "./firebase.js";

const welcomeText = document.getElementById("welcome-text");
const todayDate = document.getElementById("today-date");
const logoutBtn = document.getElementById("logout-btn");
const statusMessage = document.getElementById("status-message");
const settingsForm = document.getElementById("settings-form");
const defaultGoalInput = document.getElementById("default-goal");
const hydrationGoalInput = document.getElementById("hydration-goal");
const targetWeightInput = document.getElementById("target-weight");

let currentUser = null;

const getOrdinal = (day) => (day > 3 && day < 21 ? "th" : ["th", "st", "nd", "rd"][day % 10] || "th");
const formatLongDate = (d) =>
  `${d.toLocaleDateString(undefined, { weekday: "long" })} the ${d.getDate()}${getOrdinal(d.getDate())} ${d.toLocaleDateString(undefined, { month: "long" })} ${d.getFullYear()}`;

function showMessage(message, type = "success") {
  statusMessage.textContent = message;
  statusMessage.classList.remove("error", "success");
  statusMessage.classList.add(type);
}

function settingsRef(uid) {
  return doc(db, "users", uid, "settings", "preferences");
}

async function loadSettings(uid) {
  const snap = await getDoc(settingsRef(uid));
  if (!snap.exists()) {
    defaultGoalInput.value = "2200";
    hydrationGoalInput.value = "2000";
    targetWeightInput.value = "";
    return;
  }
  const data = snap.data();
  defaultGoalInput.value = String(data.dailyCalorieGoalDefault ?? 2200);
  hydrationGoalInput.value = String(data.hydrationGoalMl ?? 2000);
  targetWeightInput.value = data.targetWeightKg ? String(data.targetWeightKg) : "";
}

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "./index.html";
});

settingsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const dailyCalorieGoalDefault = Number(defaultGoalInput.value);
  const hydrationGoalMl = Number(hydrationGoalInput.value);
  const targetWeightKg = targetWeightInput.value ? Number(targetWeightInput.value) : null;

  if (!Number.isFinite(dailyCalorieGoalDefault) || dailyCalorieGoalDefault <= 0) {
    showMessage("Enter a valid default calorie goal.", "error");
    return;
  }
  if (!Number.isFinite(hydrationGoalMl) || hydrationGoalMl <= 0) {
    showMessage("Enter a valid hydration goal.", "error");
    return;
  }
  if (targetWeightKg !== null && (!Number.isFinite(targetWeightKg) || targetWeightKg <= 0)) {
    showMessage("Enter a valid target weight.", "error");
    return;
  }

  try {
    await setDoc(settingsRef(currentUser.uid), {
      dailyCalorieGoalDefault,
      hydrationGoalMl,
      targetWeightKg,
      updatedAt: serverTimestamp(),
    });
    showMessage("Preferences saved.");
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
  todayDate.textContent = formatLongDate(new Date());
  welcomeText.textContent = `Signed in as ${user.email.split("@")[0]}`;
  await loadSettings(user.uid);
});
