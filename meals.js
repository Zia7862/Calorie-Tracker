import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { auth, db, serverTimestamp } from "./firebase.js";

const welcomeText = document.getElementById("welcome-text");
const todayDate = document.getElementById("today-date");
const logoutBtn = document.getElementById("logout-btn");
const statusMessage = document.getElementById("status-message");
const mealForm = document.getElementById("meal-form");
const mealDateInput = document.getElementById("meal-date");
const mealNameInput = document.getElementById("meal-name");
const mealTypeInput = document.getElementById("meal-type");
const mealCaloriesInput = document.getElementById("meal-calories");
const mealsListEl = document.getElementById("meals-list");

let currentUser = null;

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
  return ["th", "st", "nd", "rd"][day % 10] || "th";
}

function formatLongDate(date) {
  const weekday = date.toLocaleDateString(undefined, { weekday: "long" });
  const month = date.toLocaleDateString(undefined, { month: "long" });
  const day = date.getDate();
  const year = date.getFullYear();
  return `${weekday} the ${day}${getOrdinal(day)} ${month} ${year}`;
}

function showMessage(message, type = "success") {
  statusMessage.textContent = message;
  statusMessage.classList.remove("error", "success");
  statusMessage.classList.add(type);
}

function getMealsCollection(uid) {
  return collection(db, "users", uid, "meals");
}

async function refreshMeals() {
  if (!currentUser) {
    return;
  }
  const dateKey = mealDateInput.value;
  const mealsQuery = query(getMealsCollection(currentUser.uid), where("dateKey", "==", dateKey));
  const snapshot = await getDocs(mealsQuery);
  const meals = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));

  if (!meals.length) {
    mealsListEl.innerHTML = "<li><span>No meals logged yet for this date.</span></li>";
    return;
  }

  mealsListEl.innerHTML = meals
    .map(
      (meal) => `
      <li>
        <span>${meal.mealType}: ${meal.name}</span>
        <strong>${meal.calories} kcal</strong>
        <button class="delete-btn" data-meal-id="${meal.id}" type="button">Delete</button>
      </li>
    `
    )
    .join("");
}

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "./index.html";
});

mealDateInput.addEventListener("change", () => {
  refreshMeals().catch((error) => showMessage(error.message, "error"));
});

mealForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentUser) {
    return;
  }

  const dateKey = mealDateInput.value;
  const name = mealNameInput.value.trim();
  const mealType = mealTypeInput.value;
  const calories = Number(mealCaloriesInput.value);

  if (!dateKey || !name || !Number.isFinite(calories) || calories <= 0) {
    showMessage("Please enter valid meal details.", "error");
    return;
  }

  try {
    await addDoc(getMealsCollection(currentUser.uid), {
      dateKey,
      name,
      mealType,
      calories,
      createdAt: serverTimestamp(),
    });
    mealNameInput.value = "";
    mealCaloriesInput.value = "";
    showMessage("Meal saved.");
    await refreshMeals();
  } catch (error) {
    showMessage(error.message, "error");
  }
});

mealsListEl.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }
  const mealId = target.dataset.mealId;
  if (!mealId || !currentUser) {
    return;
  }
  try {
    await deleteDoc(doc(db, "users", currentUser.uid, "meals", mealId));
    showMessage("Meal deleted.");
    await refreshMeals();
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
  mealDateInput.value = getDateKey(today);
  welcomeText.textContent = `Signed in as ${user.email.split("@")[0]}`;
  await refreshMeals();
});
