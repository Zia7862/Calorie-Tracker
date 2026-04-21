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
const biologicalSexInput = document.getElementById("biological-sex");
const heightCmInput = document.getElementById("height-cm");
const goalWeightInput = document.getElementById("goal-weight");
const goalTimelineDateInput = document.getElementById("goal-timeline-date");
const defaultGoalInput = document.getElementById("default-goal");
const hydrationGoalInput = document.getElementById("hydration-goal");
const SELECTED_DATE_KEY_STORAGE = "nutri_selected_date";

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

function parseHydrationLitres(raw) {
  const n = Number(String(raw).trim().replace(",", "."));
  return n;
}

async function loadSettings(uid) {
  const userSnap = await getDoc(doc(db, "users", uid));
  const userData = userSnap.exists() ? userSnap.data() : {};
  firstNameInput.value = userData.firstName ?? "";
  lastNameInput.value = userData.lastName ?? "";
  ageInput.value = userData.age != null && userData.age !== "" ? String(userData.age) : "";
  if (biologicalSexInput) {
    biologicalSexInput.value = userData.biologicalSex ?? "";
  }
  heightCmInput.value = userData.heightCm != null && userData.heightCm !== "" ? String(userData.heightCm) : "";
  goalWeightInput.value = userData.goalWeightKg != null && userData.goalWeightKg !== "" ? String(userData.goalWeightKg) : "";
  goalTimelineDateInput.value = userData.goalTimelineDate ?? "";

  const snap = await getDoc(settingsRef(uid));
  if (!snap.exists()) {
    defaultGoalInput.value = "2200";
    hydrationGoalInput.value = "2";
    return;
  }
  const data = snap.data();
  defaultGoalInput.value = String(data.dailyCalorieGoalDefault ?? 2200);
  const ml = Number(data.hydrationGoalMl);
  hydrationGoalInput.value = Number.isFinite(ml) && ml > 0 ? String(ml / 1000) : "2";
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
  const biologicalSex = biologicalSexInput?.value || "";
  const heightCm = Number(heightCmInput.value);
  const goalWeightKg = Number(goalWeightInput.value);
  const goalTimelineDate = goalTimelineDateInput.value;
  const dailyCalorieGoalDefault = Number(defaultGoalInput.value);
  const hydrationLitres = parseHydrationLitres(hydrationGoalInput.value);

  if (!firstName || !lastName) {
    showMessage("Enter your first name and surname.", "error");
    return;
  }
  if (!Number.isFinite(age)) {
    showMessage("Enter a valid age.", "error");
    return;
  }
  if (!Number.isFinite(heightCm)) {
    showMessage("Enter a valid height.", "error");
    return;
  }
  if (!Number.isFinite(goalWeightKg)) {
    showMessage("Enter a valid goal weight.", "error");
    return;
  }
  if (!goalTimelineDate) {
    showMessage("Select a goal timeline date.", "error");
    return;
  }
  if (!Number.isFinite(dailyCalorieGoalDefault)) {
    showMessage("Enter a valid default calorie goal.", "error");
    return;
  }
  if (!Number.isFinite(hydrationLitres)) {
    showMessage("Hydration goal must be a number (litres).", "error");
    return;
  }

  const hydrationGoalMl = Math.round(hydrationLitres * 1000);

  try {
    await setDoc(
      doc(db, "users", currentUser.uid),
      {
        firstName,
        lastName,
        age,
        biologicalSex: biologicalSex || null,
        heightCm,
        goalWeightKg,
        goalTimelineDate,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    await setDoc(
      settingsRef(currentUser.uid),
      {
        dailyCalorieGoalDefault,
        hydrationGoalMl,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    showMessage("Preferences saved.");
    await loadSettings(currentUser.uid);
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
  const selectedDateKey = localStorage.getItem(SELECTED_DATE_KEY_STORAGE);
  todayDate.textContent = selectedDateKey ? formatLongDate(new Date(`${selectedDateKey}T00:00:00`)) : formatLongDate(new Date());
  const profileSnap = await getDoc(doc(db, "users", user.uid));
  const profile = profileSnap.exists() ? profileSnap.data() : {};
  const displayName = profile.firstName ? `${profile.firstName} ${profile.lastName || ""}`.trim() : user.email.split("@")[0];
  welcomeText.textContent = `Signed in as ${displayName}`;
  await loadSettings(user.uid);
});
