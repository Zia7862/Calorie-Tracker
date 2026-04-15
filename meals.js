import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { auth, db, serverTimestamp } from "./firebase.js";

const welcomeText = document.getElementById("welcome-text");
const todayDate = document.getElementById("today-date");
const logoutBtn = document.getElementById("logout-btn");
const statusMessage = document.getElementById("status-message");
const showAddViewBtn = document.getElementById("show-add-view");
const showLibraryViewBtn = document.getElementById("show-library-view");
const addViewEls = Array.from(document.querySelectorAll(".view-add"));
const libraryViewEls = Array.from(document.querySelectorAll(".view-library"));
const mealForm = document.getElementById("meal-form");
const mealDateInput = document.getElementById("meal-date");
const mealTemplateInput = document.getElementById("meal-template");
const mealNameInput = document.getElementById("meal-name");
const mealTypeInput = document.getElementById("meal-type");
const mealCaloriesInput = document.getElementById("meal-calories");
const mealWeightInput = document.getElementById("meal-weight");
const mealsListEl = document.getElementById("meals-list");
const templateForm = document.getElementById("template-form");
const templateNameInput = document.getElementById("template-name");
const templateCaloriesInput = document.getElementById("template-calories");
const templateWeightInput = document.getElementById("template-weight");
const templatesListEl = document.getElementById("templates-list");

let currentUser = null;
let mealTemplates = [];
const urlDateParam = new URLSearchParams(window.location.search).get("date");

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

function setMealsView(view) {
  const showAdd = view === "add";
  addViewEls.forEach((el) => el.classList.toggle("hidden-view", !showAdd));
  libraryViewEls.forEach((el) => el.classList.toggle("hidden-view", showAdd));
  showAddViewBtn.classList.toggle("active", showAdd);
  showLibraryViewBtn.classList.toggle("active", !showAdd);
}

function getMealsCollection(uid) {
  return collection(db, "users", uid, "meals");
}

function getMealTemplatesCollection(uid) {
  return collection(db, "users", uid, "mealTemplates");
}

function renderMealTemplateOptions() {
  mealTemplateInput.innerHTML = `
    <option value="">Choose a saved meal</option>
    ${mealTemplates
      .map((template) => `<option value="${template.id}">${template.name} (${template.calories} kcal)</option>`)
      .join("")}
  `;
}

function renderMealTemplatesList() {
  if (!mealTemplates.length) {
    templatesListEl.innerHTML = "<li><span>No saved meals yet.</span></li>";
    return;
  }
  templatesListEl.innerHTML = mealTemplates
    .map(
      (template) => `
      <li>
        <span>${template.name}${template.defaultWeightGrams ? ` (${template.defaultWeightGrams}g)` : ""}</span>
        <strong>${template.calories} kcal</strong>
        <button class="delete-btn" data-template-id="${template.id}" type="button">Delete</button>
      </li>
    `
    )
    .join("");
}

async function refreshMealTemplates() {
  if (!currentUser) {
    return;
  }
  const templatesQuery = query(getMealTemplatesCollection(currentUser.uid), orderBy("name", "asc"));
  const snapshot = await getDocs(templatesQuery);
  mealTemplates = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  renderMealTemplateOptions();
  renderMealTemplatesList();
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
        <span>${meal.mealType}: ${meal.name}${meal.weightGrams ? ` (${meal.weightGrams}g)` : ""}</span>
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

showAddViewBtn.addEventListener("click", () => setMealsView("add"));
showLibraryViewBtn.addEventListener("click", () => setMealsView("library"));

mealTemplateInput.addEventListener("change", () => {
  const selectedTemplate = mealTemplates.find((template) => template.id === mealTemplateInput.value);
  if (!selectedTemplate) {
    return;
  }
  mealNameInput.value = selectedTemplate.name;
  mealCaloriesInput.value = String(selectedTemplate.calories);
  mealWeightInput.value = selectedTemplate.defaultWeightGrams
    ? String(selectedTemplate.defaultWeightGrams)
    : "";
});

templateForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentUser) {
    return;
  }
  const name = templateNameInput.value.trim();
  const calories = Number(templateCaloriesInput.value);
  const defaultWeightGrams = templateWeightInput.value ? Number(templateWeightInput.value) : null;

  if (!name || !Number.isFinite(calories) || calories <= 0) {
    showMessage("Please enter a valid saved meal.", "error");
    return;
  }
  if (defaultWeightGrams !== null && (!Number.isFinite(defaultWeightGrams) || defaultWeightGrams <= 0)) {
    showMessage("If provided, weight must be valid.", "error");
    return;
  }

  try {
    await addDoc(getMealTemplatesCollection(currentUser.uid), {
      name,
      calories,
      defaultWeightGrams,
      createdAt: serverTimestamp(),
    });
    templateNameInput.value = "";
    templateCaloriesInput.value = "";
    templateWeightInput.value = "";
    showMessage("Saved meal added to your library.");
    await refreshMealTemplates();
  } catch (error) {
    showMessage(error.message, "error");
  }
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
  const weightGrams = mealWeightInput.value ? Number(mealWeightInput.value) : null;

  if (!dateKey || !name || !Number.isFinite(calories) || calories <= 0) {
    showMessage("Please enter valid meal details.", "error");
    return;
  }
  if (weightGrams !== null && (!Number.isFinite(weightGrams) || weightGrams <= 0)) {
    showMessage("If entered, weight must be valid.", "error");
    return;
  }

  try {
    await addDoc(getMealsCollection(currentUser.uid), {
      dateKey,
      name,
      mealType,
      calories,
      weightGrams,
      createdAt: serverTimestamp(),
    });
    mealNameInput.value = "";
    mealCaloriesInput.value = "";
    mealWeightInput.value = "";
    mealTemplateInput.value = "";
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

templatesListEl.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }
  const templateId = target.dataset.templateId;
  if (!templateId || !currentUser) {
    return;
  }
  try {
    await deleteDoc(doc(db, "users", currentUser.uid, "mealTemplates", templateId));
    showMessage("Saved meal deleted.");
    await refreshMealTemplates();
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
  const initialDate = urlDateParam || getDateKey(today);
  mealDateInput.value = initialDate;
  welcomeText.textContent = `Signed in as ${user.email.split("@")[0]}`;
  setMealsView("add");
  await refreshMealTemplates();
  await refreshMeals();
});
