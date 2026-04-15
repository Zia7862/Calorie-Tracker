import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { auth, db, serverTimestamp } from "./firebase.js";

const welcomeText = document.getElementById("welcome-text");
const todayDate = document.getElementById("today-date");
const logoutBtn = document.getElementById("logout-btn");
const statusMessage = document.getElementById("status-message");
const settingsForm = document.getElementById("settings-form");
const firstNameInput = document.getElementById("first-name");
const lastNameInput = document.getElementById("last-name");
const ageInput = document.getElementById("age");
const heightCmInput = document.getElementById("height-cm");
const goalWeightInput = document.getElementById("goal-weight");
const goalTimelineDateInput = document.getElementById("goal-timeline-date");
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
  const userSnap = await getDoc(doc(db, "users", uid));
  const userData = userSnap.exists() ? userSnap.data() : {};
  firstNameInput.value = userData.firstName ?? "";
  lastNameInput.value = userData.lastName ?? "";
  ageInput.value = userData.age ? String(userData.age) : "";
  heightCmInput.value = userData.heightCm ? String(userData.heightCm) : "";
  goalWeightInput.value = userData.goalWeightKg ? String(userData.goalWeightKg) : "";
  goalTimelineDateInput.value = userData.goalTimelineDate ?? "";

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
  const firstName = firstNameInput.value.trim();
  const lastName = lastNameInput.value.trim();
  const age = Number(ageInput.value);
  const heightCm = Number(heightCmInput.value);
  const goalWeightKg = Number(goalWeightInput.value);
  const goalTimelineDate = goalTimelineDateInput.value;
  const dailyCalorieGoalDefault = Number(defaultGoalInput.value);
  const hydrationGoalMl = Number(hydrationGoalInput.value);
  const targetWeightKg = targetWeightInput.value ? Number(targetWeightInput.value) : null;

  if (!firstName || !lastName) {
    showMessage("Enter your first name and surname.", "error");
    return;
  }
  if (!Number.isFinite(age) || age < 13 || age > 100) {
    showMessage("Enter a valid age.", "error");
    return;
  }
  if (!Number.isFinite(heightCm) || heightCm < 120 || heightCm > 250) {
    showMessage("Enter a valid height.", "error");
    return;
  }
  if (!Number.isFinite(goalWeightKg) || goalWeightKg < 30 || goalWeightKg > 300) {
    showMessage("Enter a valid goal weight.", "error");
    return;
  }
  if (!goalTimelineDate) {
    showMessage("Select a goal timeline date.", "error");
    return;
  }
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
    await setDoc(
      doc(db, "users", currentUser.uid),
      {
        firstName,
        lastName,
        age,
        heightCm,
        goalWeightKg,
        goalTimelineDate,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

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
