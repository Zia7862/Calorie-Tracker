import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { addDoc, collection, doc, getDoc, getDocs, query, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { auth, db, serverTimestamp } from "./firebase.js";

const welcomeText = document.getElementById("welcome-text");
const todayDate = document.getElementById("today-date");
const logoutBtn = document.getElementById("logout-btn");
const statusMessage = document.getElementById("status-message");
const planForm = document.getElementById("plan-form");
const planDirectionInput = document.getElementById("plan-direction");
const planSpeedInput = document.getElementById("plan-speed");
const planSummary = document.getElementById("plan-summary");
const weeklyCalorieGoalEl = document.getElementById("weekly-calorie-goal");
const dailyCalorieGoalEl = document.getElementById("daily-calorie-goal");
const weightForm = document.getElementById("weight-form");
const weightDateInput = document.getElementById("weight-date");
const weightValueInput = document.getElementById("weight-value");
const weightList = document.getElementById("weight-list");

let currentUser = null;
let profileData = null;
const urlDateParam = new URLSearchParams(window.location.search).get("date");

const getDateKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const getOrdinal = (day) => (day > 3 && day < 21 ? "th" : ["th", "st", "nd", "rd"][day % 10] || "th");
const formatLongDate = (d) =>
  `${d.toLocaleDateString(undefined, { weekday: "long" })} the ${d.getDate()}${getOrdinal(d.getDate())} ${d.toLocaleDateString(undefined, { month: "long" })} ${d.getFullYear()}`;

function showMessage(message, type = "success") {
  statusMessage.textContent = message;
  statusMessage.classList.remove("error", "success");
  statusMessage.classList.add(type);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function paceKgPerWeek(direction, speed) {
  if (direction === "lose") {
    if (speed === "fast") {
      return -1.0;
    }
    if (speed === "medium") {
      return -0.5;
    }
    return -0.25;
  }
  if (speed === "fast") {
    return 1.0;
  }
  if (speed === "medium") {
    return 0.5;
  }
  return 0.25;
}

function calculateWeeklyPlan(profile, direction, speed) {
  if (!profile) {
    return null;
  }

  const currentWeightKg = Number(profile.currentWeightKg || profile.startWeightKg);
  const goalWeightKg = Number(profile.goalWeightKg);
  const heightCm = Number(profile.heightCm);
  const age = Number(profile.age);
  const goalTimelineDate = profile.goalTimelineDate;

  if (!Number.isFinite(currentWeightKg) || !Number.isFinite(goalWeightKg) || !Number.isFinite(heightCm) || !Number.isFinite(age) || !goalTimelineDate) {
    return null;
  }

  const today = new Date();
  const [year, month, day] = goalTimelineDate.split("-").map(Number);
  const endDate = new Date(year, month - 1, day);
  const daysLeft = Math.max(1, Math.ceil((endDate - today) / (24 * 60 * 60 * 1000)));
  const weeksLeft = Math.max(1, daysLeft / 7);

  const requiredWeeklyKg = (goalWeightKg - currentWeightKg) / weeksLeft;
  const speedWeeklyKg = paceKgPerWeek(direction, speed);
  const selectedWeeklyKg = direction === "lose"
    ? Math.max(requiredWeeklyKg, speedWeeklyKg)
    : Math.min(requiredWeeklyKg, speedWeeklyKg);

  const bmr = 10 * currentWeightKg + 6.25 * heightCm - 5 * age - 80;
  const maintenanceCalories = bmr * 1.35;
  const dailyAdjustment = (selectedWeeklyKg * 7700) / 7;
  const dailyCalories = clamp(Math.round((maintenanceCalories + dailyAdjustment) / 50) * 50, 1200, 4500);
  const weeklyCalories = Math.round(dailyCalories * 7);

  return {
    weeklyCalories,
    dailyCalories,
    selectedWeeklyKg,
    weeksLeft: Math.round(weeksLeft * 10) / 10,
  };
}

function renderWeeklyPlan(plan) {
  if (!plan) {
    weeklyCalorieGoalEl.textContent = "0 kcal/week";
    dailyCalorieGoalEl.textContent = "0 kcal/day";
    planSummary.textContent = "Add full profile data in Settings to calculate your weekly target.";
    return;
  }
  weeklyCalorieGoalEl.textContent = `${plan.weeklyCalories.toLocaleString()} kcal/week`;
  dailyCalorieGoalEl.textContent = `${plan.dailyCalories.toLocaleString()} kcal/day`;
  const weeklyKgText = `${Math.abs(plan.selectedWeeklyKg).toFixed(2)} kg/week`;
  const directionText = plan.selectedWeeklyKg < 0 ? "loss" : "gain";
  planSummary.textContent = `Based on your timeline (${plan.weeksLeft} weeks left), target pace is ${weeklyKgText} ${directionText}.`;
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

planForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentUser || !profileData) {
    showMessage("Profile is missing. Update your settings first.", "error");
    return;
  }
  const direction = planDirectionInput.value;
  const speed = planSpeedInput.value;
  const plan = calculateWeeklyPlan(profileData, direction, speed);
  if (!plan) {
    showMessage("Not enough profile data to calculate plan.", "error");
    return;
  }

  try {
    await setDoc(doc(db, "users", currentUser.uid, "settings", "preferences"), {
      weeklyPlanDirection: direction,
      weeklyPlanSpeed: speed,
      weeklyCalorieGoal: plan.weeklyCalories,
      dailyCalorieGoalDefault: plan.dailyCalories,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    renderWeeklyPlan(plan);
    showMessage("Weekly calorie plan saved.");
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
    await setDoc(
      doc(db, "users", currentUser.uid),
      {
        currentWeightKg: weight,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
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
  weightDateInput.value = urlDateParam || dateKey;
  welcomeText.textContent = `Signed in as ${user.email.split("@")[0]}`;
  const userSnap = await getDoc(doc(db, "users", user.uid));
  profileData = userSnap.exists() ? userSnap.data() : null;

  const settingsSnap = await getDoc(doc(db, "users", user.uid, "settings", "preferences"));
  const settingsData = settingsSnap.exists() ? settingsSnap.data() : {};
  planDirectionInput.value = settingsData.weeklyPlanDirection || "lose";
  planSpeedInput.value = settingsData.weeklyPlanSpeed || "medium";
  renderWeeklyPlan(calculateWeeklyPlan(profileData, planDirectionInput.value, planSpeedInput.value));
  await refreshWeights();
});
