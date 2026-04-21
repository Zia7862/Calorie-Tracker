import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { auth, db, serverTimestamp } from "./firebase.js";

const welcomeText = document.getElementById("welcome-text");
const todayDate = document.getElementById("today-date");
const logoutBtn = document.getElementById("logout-btn");
const statusMessage = document.getElementById("status-message");
const planForm = document.getElementById("plan-form");
const planDirectionInput = document.getElementById("plan-direction");
const planSummary = document.getElementById("plan-summary");
const weeklyCalorieGoalEl = document.getElementById("weekly-calorie-goal");
const dailyCalorieGoalEl = document.getElementById("daily-calorie-goal");
const weightForm = document.getElementById("weight-form");
const weightDateInput = document.getElementById("weight-date");
const weightValueInput = document.getElementById("weight-value");
const weightList = document.getElementById("weight-list");
const weightScaleNeedle = document.getElementById("weight-scale-needle");
const latestScaleWeightEl = document.getElementById("latest-scale-weight");
const planObjectiveStrip = document.getElementById("plan-objective-strip");
const planModal = document.getElementById("plan-modal");
const planModalDesc = document.getElementById("plan-modal-desc");
const planModalInput = document.getElementById("plan-modal-input");
const planModalCancel = document.getElementById("plan-modal-cancel");
const planModalConfirm = document.getElementById("plan-modal-confirm");

let currentUser = null;
let profileData = null;
const urlDateParam = new URLSearchParams(window.location.search).get("date");
const SELECTED_DATE_KEY_STORAGE = "nutri_selected_date";

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

function formatHistoryDateLabel(dateKey) {
  const [y, m, d] = String(dateKey).split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  return dt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function updateObjectiveStrip(settingsData) {
  if (!planObjectiveStrip) {
    return;
  }
  const dir = settingsData.weeklyPlanDirection || "lose";
  const kg = Number(settingsData.weeklyPlanKgPerWeek);
  if (!Number.isFinite(kg) || kg <= 0) {
    planObjectiveStrip.classList.add("hidden-view");
    planObjectiveStrip.textContent = "";
    return;
  }
  planObjectiveStrip.classList.remove("hidden-view");
  const verb = dir === "lose" ? "Lose" : "Gain";
  planObjectiveStrip.textContent = `Your objective: ${verb} ${Math.abs(kg)} kg per week · Daily target below is calculated for that pace.`;
}

function openPlanModal(direction) {
  if (!planModal || !planModalDesc || !planModalInput) {
    return;
  }
  planModalDesc.textContent =
    direction === "lose"
      ? "How many kilograms do you want to lose per week?"
      : "How many kilograms do you want to gain per week?";
  planModalInput.value = "0.5";
  planModal.classList.remove("hidden-view");
  planModal.setAttribute("aria-hidden", "false");
  requestAnimationFrame(() => {
    planModalInput.focus();
    planModalInput.select();
  });
}

function closePlanModal() {
  if (!planModal) {
    return;
  }
  planModal.classList.add("hidden-view");
  planModal.setAttribute("aria-hidden", "true");
}

function renderWeightScale(latestWeightKg, profile) {
  if (!weightScaleNeedle || !latestScaleWeightEl) {
    return;
  }
  const fallbackWeight = Number(profile?.currentWeightKg || profile?.startWeightKg || profile?.goalWeightKg || 70);
  const currentWeight = Number.isFinite(Number(latestWeightKg)) ? Number(latestWeightKg) : fallbackWeight;
  const goalWeight = Number(profile?.goalWeightKg) || currentWeight;
  const minWeight = Math.min(currentWeight, goalWeight, fallbackWeight) - 15;
  const maxWeight = Math.max(currentWeight, goalWeight, fallbackWeight) + 15;
  const ratio = (currentWeight - minWeight) / Math.max(1, maxWeight - minWeight);
  const degrees = -90 + clamp(ratio, 0, 1) * 180;
  weightScaleNeedle.style.transform = `translateX(-50%) rotate(${degrees}deg)`;
  latestScaleWeightEl.textContent = `${currentWeight.toFixed(1)} kg`;
}

function calculateWeeklyPlan(profile, weeklyKgTarget) {
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

  if (!Number.isFinite(Number(weeklyKgTarget)) || Number(weeklyKgTarget) === 0) {
    return null;
  }
  const selectedWeeklyKg = Number(weeklyKgTarget);

  const deltaKgToGoal = goalWeightKg - currentWeightKg;
  const requiredDailyKgFromDeadline = deltaKgToGoal / daysLeft;
  const userDailyKgFromWeekly = selectedWeeklyKg / 7;
  const blendedDailyKg = (requiredDailyKgFromDeadline + userDailyKgFromWeekly) / 2;

  const bmr = 10 * currentWeightKg + 6.25 * heightCm - 5 * age - 80;
  const maintenanceCalories = bmr * 1.35;
  const dailyAdjustment = blendedDailyKg * 7700;
  const dailyCalories = clamp(Math.round((maintenanceCalories + dailyAdjustment) / 50) * 50, 1200, 4500);
  const weeklyCalories = Math.round(dailyCalories * 7);

  const dailyFromDeadlineOnly = maintenanceCalories + requiredDailyKgFromDeadline * 7700;
  const dailyFromPaceOnly = maintenanceCalories + userDailyKgFromWeekly * 7700;

  return {
    weeklyCalories,
    dailyCalories,
    selectedWeeklyKg,
    weeksLeft: Math.round(weeksLeft * 10) / 10,
    dailyFromDeadlineOnly: clamp(Math.round(dailyFromDeadlineOnly / 50) * 50, 1200, 4500),
    dailyFromPaceOnly: clamp(Math.round(dailyFromPaceOnly / 50) * 50, 1200, 4500),
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
  planSummary.textContent = `Pace: ${weeklyKgText} (${directionText}). Blended target (goal date + your weekly pace): ~${plan.dailyCalories.toLocaleString()} kcal/day. Roughly ${plan.dailyFromDeadlineOnly.toLocaleString()} kcal/day from goal date alone, ${plan.dailyFromPaceOnly.toLocaleString()} kcal/day from pace alone. About ${plan.weeksLeft} week(s) to goal date.`;
}

async function reloadProfile(uid) {
  const userSnap = await getDoc(doc(db, "users", uid));
  profileData = userSnap.exists() ? userSnap.data() : null;
}

async function refreshWeights() {
  if (!currentUser) {
    return;
  }
  const snap = await getDocs(query(collection(db, "users", currentUser.uid, "weightLogs")));
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.dateKey > b.dateKey ? -1 : 1));
  if (!rows.length) {
    weightList.innerHTML = "<li><span>No weight entries yet.</span></li>";
    renderWeightScale(null, profileData);
    return;
  }
  renderWeightScale(rows[0]?.weight, profileData);
  weightList.innerHTML = rows
    .map(
      (w) => `
      <li>
        <span>${formatHistoryDateLabel(w.dateKey)}</span>
        <strong>${Number(w.weight).toFixed(1)} kg</strong>
        <button class="delete-btn" data-weight-log-id="${w.id}" type="button">Delete</button>
      </li>
    `
    )
    .join("");
}

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "./index.html";
});

planForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!currentUser || !profileData) {
    showMessage("Profile is missing. Update your settings first.", "error");
    return;
  }
  openPlanModal(planDirectionInput.value);
});

planModalCancel?.addEventListener("click", closePlanModal);
planModal?.addEventListener("click", (event) => {
  if (event.target === planModal) {
    closePlanModal();
  }
});

planModalConfirm?.addEventListener("click", async () => {
  if (!currentUser || !profileData || !planModalInput) {
    return;
  }
  const direction = planDirectionInput.value;
  const rawTargetKg = Number(planModalInput.value);
  if (!Number.isFinite(rawTargetKg) || rawTargetKg <= 0) {
    showMessage("Please enter a valid kg per week target.", "error");
    return;
  }
  const signedWeeklyKgTarget = direction === "lose" ? -Math.abs(rawTargetKg) : Math.abs(rawTargetKg);
  const plan = calculateWeeklyPlan(profileData, signedWeeklyKgTarget);
  if (!plan) {
    showMessage("Not enough profile data to calculate plan.", "error");
    return;
  }

  try {
    await setDoc(
      doc(db, "users", currentUser.uid, "settings", "preferences"),
      {
        weeklyPlanDirection: direction,
        weeklyPlanKgPerWeek: rawTargetKg,
        weeklyCalorieGoal: plan.weeklyCalories,
        dailyCalorieGoalDefault: plan.dailyCalories,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    renderWeeklyPlan(plan);
    updateObjectiveStrip({
      weeklyPlanDirection: direction,
      weeklyPlanKgPerWeek: rawTargetKg,
    });
    closePlanModal();
    showMessage("Weekly calorie plan saved.");
  } catch (error) {
    showMessage(error.message, "error");
  }
});

weightList.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }
  const logId = target.dataset.weightLogId;
  if (!logId || !currentUser) {
    return;
  }
  try {
    await deleteDoc(doc(db, "users", currentUser.uid, "weightLogs", logId));
    showMessage("Weight entry removed.");
    await reloadProfile(currentUser.uid);
    await refreshWeights();
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
    await reloadProfile(currentUser.uid);
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
  const dateKey = urlDateParam || localStorage.getItem(SELECTED_DATE_KEY_STORAGE) || getDateKey(today);
  localStorage.setItem(SELECTED_DATE_KEY_STORAGE, dateKey);
  todayDate.textContent = formatLongDate(new Date(`${dateKey}T00:00:00`));
  weightDateInput.value = dateKey;
  await reloadProfile(user.uid);
  const displayName = profileData?.firstName
    ? `${profileData.firstName} ${profileData.lastName || ""}`.trim()
    : user.email.split("@")[0];
  welcomeText.textContent = `Signed in as ${displayName}`;

  const settingsSnap = await getDoc(doc(db, "users", user.uid, "settings", "preferences"));
  const settingsData = settingsSnap.exists() ? settingsSnap.data() : {};
  planDirectionInput.value = settingsData.weeklyPlanDirection || "lose";
  updateObjectiveStrip(settingsData);
  const savedKgPerWeek = Number(settingsData.weeklyPlanKgPerWeek) || 0.5;
  const savedSignedTarget = planDirectionInput.value === "lose" ? -Math.abs(savedKgPerWeek) : Math.abs(savedKgPerWeek);
  renderWeeklyPlan(calculateWeeklyPlan(profileData, savedSignedTarget));
  await refreshWeights();
});
