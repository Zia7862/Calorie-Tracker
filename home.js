import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { auth, db, serverTimestamp } from "./firebase.js";

const welcomeText = document.getElementById("welcome-text");
const logoutBtn = document.getElementById("logout-btn");
const todayDate = document.getElementById("today-date");
const caloriesLeftEl = document.getElementById("calories-left");
const caloriesEatenEl = document.getElementById("calories-eaten");
const mealsLoggedEl = document.getElementById("meals-logged");
const dailyGoalEl = document.getElementById("daily-goal");
const latestWeightEl = document.getElementById("latest-weight");
const onTrackEl = document.getElementById("on-track");
const waterTodayEl = document.getElementById("water-today");
const recommendedCaloriesEl = document.getElementById("recommended-calories");
const goalProgressEl = document.getElementById("goal-progress");
const bmiValueEl = document.getElementById("bmi-value");
const bodyFatValueEl = document.getElementById("body-fat-value");
const calorieProgressFill = document.getElementById("calorie-progress-fill");
const calorieProgressLabel = document.getElementById("calorie-progress-label");
const dashHydrationFill = document.getElementById("dash-hydration-fill");
const dashHydrationLabel = document.getElementById("dash-hydration-label");
const timelineTextEl = document.getElementById("timeline-text");
const mealsListEl = document.getElementById("meals-list");
const communityListEl = document.getElementById("community-list");
const daySelectorInput = document.getElementById("day-selector");
const mealsLink = document.getElementById("meals-link");
const hydrationLink = document.getElementById("hydration-link");
const progressLink = document.getElementById("progress-link");
let currentUserId = null;
const SELECTED_DATE_KEY_STORAGE = "nutri_selected_date";
let currentTodayKey = getDateKey(new Date());
let selectedDateKey = currentTodayKey;
let viewingToday = true;

function getDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getOrdinal(day) {
  if (day > 3 && day < 21) {
    return "th";
  }
  switch (day % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

function formatLongDate(date) {
  const weekday = date.toLocaleDateString(undefined, { weekday: "long" });
  const month = date.toLocaleDateString(undefined, { month: "long" });
  const day = date.getDate();
  const year = date.getFullYear();
  return `${weekday} the ${day}${getOrdinal(day)} ${month} ${year}`;
}

function formatCalories(value) {
  return `${(Number(value) || 0).toLocaleString()} kcal`;
}

function parseDateKey(dateKey) {
  const [year, month, day] = String(dateKey).split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function clamp(num, min, max) {
  return Math.min(max, Math.max(min, num));
}

function roundToNearestFifty(value) {
  return Math.round(value / 50) * 50;
}

function syncDateLinks(dateKey) {
  localStorage.setItem(SELECTED_DATE_KEY_STORAGE, dateKey);
  const encodedDate = encodeURIComponent(dateKey);
  mealsLink.href = `./meals.html?date=${encodedDate}`;
  hydrationLink.href = `./hydration.html?date=${encodedDate}`;
  progressLink.href = `./progress.html?date=${encodedDate}`;
}

async function refreshCommunity(uid, dateKey, goalCalories, caloriesEaten) {
  try {
    const statsRef = doc(db, "dailyStats", `${uid}_${dateKey}`);
    const progressPercent = goalCalories > 0 ? Math.min(999, Math.round((caloriesEaten / goalCalories) * 100)) : 0;
    await setDoc(
      statsRef,
      {
        uid,
        dateKey,
        caloriesEaten,
        goalCalories,
        progressPercent,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    const statsSnap = await getDocs(query(collection(db, "dailyStats"), where("dateKey", "==", dateKey)));
    const rows = statsSnap.docs
      .map((item) => item.data())
      .sort((a, b) => (b.progressPercent || 0) - (a.progressPercent || 0))
      .slice(0, 8);

    if (!rows.length) {
      communityListEl.innerHTML = "<li><span>No community stats yet for this date.</span></li>";
      return;
    }

    communityListEl.innerHTML = rows
      .map((row) => {
        const name = row.uid === uid ? "You" : `User ${String(row.uid).slice(0, 6)}`;
        return `<li><span>${name}</span><strong>${row.progressPercent || 0}% of goal</strong></li>`;
      })
      .join("");
  } catch (error) {
    communityListEl.innerHTML =
      "<li><span>Community leaderboard is turned off until your Firestore rules allow signed-in users to read and write the dailyStats collection (see firestore.rules in this project).</span></li>";
  }
}

function computeBmi(weightKg, heightCm) {
  if (!Number.isFinite(weightKg) || !Number.isFinite(heightCm) || heightCm <= 0) {
    return null;
  }
  const hM = heightCm / 100;
  return weightKg / (hM * hM);
}

function estimateBodyFatPercent(bmi, age, biologicalSex) {
  if (!Number.isFinite(bmi) || !Number.isFinite(age)) {
    return null;
  }
  const sexFactor = biologicalSex === "male" ? 1 : biologicalSex === "female" ? 0 : 0.5;
  const bf = 1.2 * bmi + 0.23 * age - 10.8 * sexFactor - 5.4;
  return clamp(bf, 4, 55);
}

function computeWeightGoalJourneyPercent(profile, weightKg) {
  if (!profile || !Number.isFinite(Number(weightKg))) {
    return null;
  }
  const start = Number(profile.startWeightKg ?? profile.currentWeightKg);
  const goal = Number(profile.goalWeightKg);
  const cur = Number(weightKg);
  if (!Number.isFinite(start) || !Number.isFinite(goal) || !Number.isFinite(cur)) {
    return null;
  }
  if (Math.abs(goal - start) < 0.01) {
    return null;
  }
  if (goal < start) {
    return clamp(((start - cur) / (start - goal)) * 100, 0, 100);
  }
  return clamp(((cur - start) / (goal - start)) * 100, 0, 100);
}

function calculateCaloriePlan(profile, latestWeight, today) {
  if (!profile) {
    return null;
  }

  const weightKg = Number.isFinite(Number(latestWeight))
    ? Number(latestWeight)
    : Number(profile.currentWeightKg || profile.startWeightKg);
  const heightCm = Number(profile.heightCm);
  const age = Number(profile.age);
  const goalWeightKg = Number(profile.goalWeightKg);
  const startWeightKg = Number(profile.startWeightKg || profile.currentWeightKg);

  if (!Number.isFinite(weightKg) || !Number.isFinite(heightCm) || !Number.isFinite(age) || !Number.isFinite(goalWeightKg)) {
    return null;
  }

  const goalDate = parseDateKey(profile.goalTimelineDate);
  if (Number.isNaN(goalDate.getTime())) {
    return null;
  }
  const oneDayMs = 24 * 60 * 60 * 1000;
  const daysLeft = Math.max(1, Math.ceil((goalDate - today) / oneDayMs));
  const totalDeltaKg = goalWeightKg - weightKg;

  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age - 80;
  const maintenanceCalories = bmr * 1.35;
  const dailyAdjustment = (totalDeltaKg * 7700) / daysLeft;
  const recommendedCaloriesRaw = maintenanceCalories + dailyAdjustment;
  const recommendedCalories = clamp(roundToNearestFifty(recommendedCaloriesRaw), 1200, 4500);

  const fullJourneyKg = goalWeightKg - startWeightKg;
  const doneKg = weightKg - startWeightKg;
  let progressPercent = 0;
  if (Math.abs(fullJourneyKg) > 0.01) {
    progressPercent = clamp((doneKg / fullJourneyKg) * 100, 0, 100);
  }

  const startedAt = profile.createdAt?.seconds
    ? new Date(profile.createdAt.seconds * 1000)
    : today;
  const totalDays = Math.max(1, Math.ceil((goalDate - startedAt) / oneDayMs));
  const elapsedDays = clamp(Math.ceil((today - startedAt) / oneDayMs), 0, totalDays);
  const expectedPercent = clamp((elapsedDays / totalDays) * 100, 0, 100);

  return {
    recommendedCalories,
    daysLeft,
    progressPercent,
    expectedPercent,
    goalWeightKg,
  };
}

function getUserDocRef(uid) {
  return doc(db, "users", uid);
}

function getDailyGoalDocRef(uid, dateKey) {
  return doc(db, "users", uid, "dailyGoals", dateKey);
}

function getMealsCollection(uid) {
  return collection(db, "users", uid, "meals");
}

async function ensureUserDoc(uid, email) {
  const userRef = getUserDocRef(uid);
  const existing = await getDoc(userRef);
  if (existing.exists()) {
    return;
  }
  await setDoc(userRef, {
    email,
    createdAt: serverTimestamp(),
  });
}

function renderMeals(meals) {
  if (!meals.length) {
    mealsListEl.innerHTML = "<li><span>No meals logged for this date yet.</span></li>";
    return;
  }

  mealsListEl.innerHTML = meals
    .map((meal) => {
      const extras = [];
      if (meal.proteinG != null && Number(meal.proteinG) > 0) {
        extras.push(`P ${Number(meal.proteinG).toFixed(0)}g`);
      }
      if (meal.carbsG != null && Number(meal.carbsG) > 0) {
        extras.push(`C ${Number(meal.carbsG).toFixed(0)}g`);
      }
      const extraText = extras.length ? ` · ${extras.join(" · ")}` : "";
      return `
      <li>
        <span>${meal.mealType}: ${meal.name}${extraText}</span>
        <strong>${meal.calories} kcal</strong>
      </li>
    `;
    })
    .join("");
}

async function refreshDashboard(uid, dateKey) {
  const userSnap = await getDoc(getUserDocRef(uid));
  const profile = userSnap.exists() ? userSnap.data() : null;
  const settingsSnap = await getDoc(doc(db, "users", uid, "settings", "preferences"));
  const settingsData = settingsSnap.exists() ? settingsSnap.data() : {};

  const goalSnap = await getDoc(getDailyGoalDocRef(uid, dateKey));
  const manualGoalCalories = goalSnap.exists() ? Number(goalSnap.data().calories) || 0 : 0;

  const mealsQuery = query(getMealsCollection(uid), where("dateKey", "==", dateKey));
  const mealsSnap = await getDocs(mealsQuery);
  const meals = mealsSnap.docs.map((mealDoc) => ({ id: mealDoc.id, ...mealDoc.data() }));
  const caloriesEaten = meals.reduce((sum, meal) => sum + (Number(meal.calories) || 0), 0);

  const latestWeightQuery = query(collection(db, "users", uid, "weightLogs"), where("dateKey", "<=", dateKey));
  const latestWeightSnap = await getDocs(latestWeightQuery);
  const latestWeight = latestWeightSnap.docs
    .map((w) => w.data())
    .sort((a, b) => (a.dateKey > b.dateKey ? -1 : 1))[0]?.weight;
  const caloriePlan = calculateCaloriePlan(profile, latestWeight, parseDateKey(dateKey));
  const settingsDefaultGoal = Number(settingsData.dailyCalorieGoalDefault) || 0;
  const goalCalories = manualGoalCalories || caloriePlan?.recommendedCalories || settingsDefaultGoal || 0;
  const caloriesLeft = goalCalories - caloriesEaten;
  const hydrationGoalMl = Math.max(1, Number(settingsData.hydrationGoalMl) || 2000);

  const hydrationQuery = query(collection(db, "users", uid, "hydrationLogs"), where("dateKey", "==", dateKey));
  const hydrationSnap = await getDocs(hydrationQuery);
  const totalWaterMl = hydrationSnap.docs.reduce((sum, h) => sum + (Number(h.data().amountMl) || 0), 0);

  dailyGoalEl.textContent = formatCalories(goalCalories);
  caloriesEatenEl.textContent = formatCalories(caloriesEaten);
  caloriesLeftEl.textContent = formatCalories(Math.max(0, caloriesLeft));
  mealsLoggedEl.textContent = String(meals.length);
  latestWeightEl.textContent = Number.isFinite(latestWeight) ? `${Number(latestWeight).toFixed(1)} kg` : "-";
  waterTodayEl.textContent = `${(totalWaterMl / 1000).toFixed(1)} L`;
  recommendedCaloriesEl.textContent = formatCalories(caloriePlan?.recommendedCalories || settingsDefaultGoal || goalCalories);

  const journeyWeight = Number.isFinite(Number(latestWeight)) ? Number(latestWeight) : Number(profile?.currentWeightKg);
  const weightJourney = computeWeightGoalJourneyPercent(profile, journeyWeight);
  goalProgressEl.textContent =
    weightJourney != null ? `${Math.round(weightJourney)}% toward goal weight` : "Save your profile in Settings (and log weight on Progress)";

  const bmiWeight = Number.isFinite(Number(latestWeight)) ? Number(latestWeight) : Number(profile?.currentWeightKg);
  const bmi = Number.isFinite(bmiWeight) ? computeBmi(bmiWeight, Number(profile?.heightCm)) : null;
  if (bmiValueEl) {
    bmiValueEl.textContent = bmi != null ? bmi.toFixed(1) : "-";
  }
  const bf =
    bmi != null && profile
      ? estimateBodyFatPercent(bmi, Number(profile.age), profile.biologicalSex || "")
      : null;
  if (bodyFatValueEl) {
    bodyFatValueEl.textContent = bf != null ? `${bf.toFixed(1)}%` : "-";
  }

  const calPct = goalCalories > 0 ? Math.min(100, Math.round((caloriesEaten / goalCalories) * 100)) : 0;
  if (calorieProgressFill && calorieProgressLabel) {
    calorieProgressFill.style.width = `${calPct}%`;
    calorieProgressLabel.textContent = `${caloriesEaten.toLocaleString()} / ${goalCalories.toLocaleString()} kcal (${calPct}%)`;
  }

  const hydPct = Math.min(100, Math.round((totalWaterMl / hydrationGoalMl) * 100));
  if (dashHydrationFill && dashHydrationLabel) {
    dashHydrationFill.style.width = `${hydPct}%`;
    dashHydrationLabel.textContent = `${hydPct}% of ${(hydrationGoalMl / 1000).toFixed(1)} L goal · ${(totalWaterMl / 1000).toFixed(2)} L logged`;
  }

  if (goalCalories <= 0) {
    onTrackEl.textContent = "Set goal";
  } else if (!caloriePlan) {
    onTrackEl.textContent = caloriesLeft >= 0 ? "Yes" : `Over by ${Math.abs(caloriesLeft).toLocaleString()} kcal`;
  } else {
    const paceDelta = caloriePlan.progressPercent - caloriePlan.expectedPercent;
    onTrackEl.textContent = paceDelta >= 5 ? "Ahead" : paceDelta <= -5 ? "Behind" : "On pace";
  }

  timelineTextEl.textContent = caloriePlan
    ? `${caloriePlan.daysLeft} day(s) left to reach ${caloriePlan.goalWeightKg} kg goal.`
    : "Complete your profile in settings to unlock goal timeline guidance.";

  renderMeals(meals);
  await refreshCommunity(uid, dateKey, goalCalories, caloriesEaten);
}

logoutBtn.addEventListener("click", async () => {
  try {
    await signOut(auth);
    window.location.href = "./index.html";
  } catch (error) {
    window.alert(error.message);
  }
});

const today = new Date();
currentTodayKey = getDateKey(today);
todayDate.textContent = formatLongDate(today);
selectedDateKey = currentTodayKey;
selectedDateKey = localStorage.getItem(SELECTED_DATE_KEY_STORAGE) || selectedDateKey;
daySelectorInput.value = selectedDateKey;
todayDate.textContent = formatLongDate(parseDateKey(selectedDateKey));
syncDateLinks(selectedDateKey);

daySelectorInput.addEventListener("change", () => {
  const nextDateKey = daySelectorInput.value;
  if (!nextDateKey || !currentUserId) {
    return;
  }
  selectedDateKey = nextDateKey;
  viewingToday = selectedDateKey === currentTodayKey;
  todayDate.textContent = formatLongDate(parseDateKey(selectedDateKey));
  syncDateLinks(selectedDateKey);
  refreshDashboard(currentUserId, selectedDateKey).catch((error) => window.alert(error.message));
});

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "./index.html";
    return;
  }

  const firstPartOfEmail = user.email.split("@")[0];
  ensureUserDoc(user.uid, user.email)
    .then(async () => {
      currentUserId = user.uid;
      const userSnap = await getDoc(getUserDocRef(user.uid));
      const profile = userSnap.exists() ? userSnap.data() : {};
      const displayName = profile.firstName ? `${profile.firstName} ${profile.lastName || ""}`.trim() : firstPartOfEmail;
      welcomeText.textContent = `Signed in as ${displayName}`;

      const settingsRef = doc(db, "users", user.uid, "settings", "preferences");
      const settingsSnap = await getDoc(settingsRef);
      if (!settingsSnap.exists()) {
        await setDoc(settingsRef, {
          dailyCalorieGoalDefault: 2200,
          hydrationGoalMl: 2000,
          targetWeightKg: null,
          updatedAt: serverTimestamp(),
        });
      }
      await refreshDashboard(user.uid, selectedDateKey);
    })
    .catch((error) => {
      window.alert(error.message);
    });
});

setInterval(() => {
  const now = new Date();
  const newTodayKey = getDateKey(now);
  if (newTodayKey === currentTodayKey || !currentUserId) {
    return;
  }
  currentTodayKey = newTodayKey;
  if (viewingToday) {
    selectedDateKey = currentTodayKey;
    daySelectorInput.value = selectedDateKey;
    todayDate.textContent = formatLongDate(now);
    syncDateLinks(selectedDateKey);
    refreshDashboard(currentUserId, selectedDateKey).catch((error) => window.alert(error.message));
  }
}, 60000);
