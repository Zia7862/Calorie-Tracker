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
const mealsListEl = document.getElementById("meals-list");

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
    .map(
      (meal) => `
      <li>
        <span>${meal.mealType}: ${meal.name}</span>
        <strong>${meal.calories} kcal</strong>
      </li>
    `
    )
    .join("");
}

async function refreshDashboard(uid, dateKey) {
  const goalSnap = await getDoc(getDailyGoalDocRef(uid, dateKey));
  const goalCalories = goalSnap.exists() ? Number(goalSnap.data().calories) || 0 : 0;

  const mealsQuery = query(getMealsCollection(uid), where("dateKey", "==", dateKey));
  const mealsSnap = await getDocs(mealsQuery);
  const meals = mealsSnap.docs.map((mealDoc) => ({ id: mealDoc.id, ...mealDoc.data() }));
  const caloriesEaten = meals.reduce((sum, meal) => sum + (Number(meal.calories) || 0), 0);
  const caloriesLeft = goalCalories - caloriesEaten;

  const latestWeightQuery = query(collection(db, "users", uid, "weightLogs"), where("dateKey", "<=", dateKey));
  const latestWeightSnap = await getDocs(latestWeightQuery);
  const latestWeight = latestWeightSnap.docs
    .map((w) => w.data())
    .sort((a, b) => (a.dateKey > b.dateKey ? -1 : 1))[0]?.weight;

  const hydrationQuery = query(collection(db, "users", uid, "hydrationLogs"), where("dateKey", "==", dateKey));
  const hydrationSnap = await getDocs(hydrationQuery);
  const totalWaterMl = hydrationSnap.docs.reduce((sum, h) => sum + (Number(h.data().amountMl) || 0), 0);

  dailyGoalEl.textContent = formatCalories(goalCalories);
  caloriesEatenEl.textContent = formatCalories(caloriesEaten);
  caloriesLeftEl.textContent = formatCalories(caloriesLeft);
  mealsLoggedEl.textContent = String(meals.length);
  latestWeightEl.textContent = Number.isFinite(latestWeight) ? `${Number(latestWeight).toFixed(1)} kg` : "-";
  waterTodayEl.textContent = `${(totalWaterMl / 1000).toFixed(1)} L`;
  onTrackEl.textContent = goalCalories > 0 ? (caloriesLeft >= 0 ? "Yes" : "Over target") : "Set goal";

  renderMeals(meals);
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
const todayKey = getDateKey(today);
todayDate.textContent = formatLongDate(today);

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "./index.html";
    return;
  }

  const firstPartOfEmail = user.email.split("@")[0];
  welcomeText.textContent = `Signed in as ${firstPartOfEmail}`;
  ensureUserDoc(user.uid, user.email)
    .then(async () => {
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
      await refreshDashboard(user.uid, todayKey);
    })
    .catch((error) => {
      window.alert(error.message);
    });
});
