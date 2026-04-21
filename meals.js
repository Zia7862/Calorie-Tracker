import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { auth, db, serverTimestamp } from "./firebase.js";

const MEAL_SLOTS = [
  { key: "Breakfast", label: "Breakfast", short: "Breakfast", icon: "🌅" },
  { key: "Lunch", label: "Lunch", short: "Lunch", icon: "☀️" },
  { key: "Supper", label: "Supper", short: "Supper", icon: "🌙" },
  { key: "Morning snack", label: "Morning snack", short: "AM snack", icon: "🥨" },
  { key: "Afternoon snack", label: "Afternoon snack", short: "PM snack", icon: "🍎" },
  { key: "Evening snack", label: "Evening snack", short: "Eve snack", icon: "🍫" },
];

const welcomeText = document.getElementById("welcome-text");
const todayDate = document.getElementById("today-date");
const logoutBtn = document.getElementById("logout-btn");
const statusMessage = document.getElementById("status-message");
const showAddViewBtn = document.getElementById("show-add-view");
const showLibraryViewBtn = document.getElementById("show-library-view");
const addViewEls = Array.from(document.querySelectorAll(".view-add"));
const libraryViewEls = Array.from(document.querySelectorAll(".view-library"));
const addSlotBubblesEl = document.getElementById("add-meal-slot-bubbles");
const templateSlotBubblesEl = document.getElementById("template-slot-bubbles");
const mealSourceTabs = Array.from(document.querySelectorAll(".meal-source-tab"));
const mealLibrarySearchWrap = document.getElementById("meal-library-search-wrap");
const mealLibrarySearchInput = document.getElementById("meal-library-search");
const mealPickListEl = document.getElementById("meal-pick-list");
const mealForm = document.getElementById("meal-form");
const mealNameInput = document.getElementById("meal-name");
const mealCaloriesInput = document.getElementById("meal-calories");
const mealProteinInput = document.getElementById("meal-protein");
const mealCarbsInput = document.getElementById("meal-carbs");
const mealWeightInput = document.getElementById("meal-weight");
const mealsListEl = document.getElementById("meals-list");
const templateForm = document.getElementById("template-form");
const templateNameInput = document.getElementById("template-name");
const templateCaloriesInput = document.getElementById("template-calories");
const templateProteinInput = document.getElementById("template-protein");
const templateCarbsInput = document.getElementById("template-carbs");
const templateWeightInput = document.getElementById("template-weight");
const templatesListEl = document.getElementById("templates-list");

let currentUser = null;
let mealTemplates = [];
const urlDateParam = new URLSearchParams(window.location.search).get("date");
const SELECTED_DATE_KEY_STORAGE = "nutri_selected_date";
let selectedDateKey = "";
let selectedAddSlot = MEAL_SLOTS[0].key;
let selectedTemplateSlot = MEAL_SLOTS[0].key;
let addMealSource = "slot";

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

function renderSlotBubbles(container, selectedKey, onSelect) {
  container.innerHTML = MEAL_SLOTS.map(
    (slot) => `
    <button type="button" class="meal-slot-bubble ${slot.key === selectedKey ? "active" : ""}" data-slot="${slot.key}">
      <span class="meal-slot-icon">${slot.icon}</span>
      <span class="meal-slot-label">${slot.short}</span>
    </button>
  `
  ).join("");
  container.querySelectorAll(".meal-slot-bubble").forEach((btn) => {
    btn.addEventListener("click", () => {
      onSelect(btn.dataset.slot);
      renderSlotBubbles(container, btn.dataset.slot, onSelect);
    });
  });
}

function setAddMealSource(source) {
  addMealSource = source;
  mealSourceTabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.source === source));
  mealLibrarySearchWrap.classList.toggle("hidden-view", source !== "all");
  renderMealPickList();
}

function templatesForSlot(slotKey) {
  return mealTemplates.filter((t) => (t.mealSlot || "") === slotKey);
}

function templatesMatchingSearch(query) {
  const q = query.trim().toLowerCase();
  if (!q) {
    return mealTemplates;
  }
  return mealTemplates.filter((t) => String(t.name || "").toLowerCase().includes(q));
}

function renderMealPickList() {
  const list =
    addMealSource === "slot" ? templatesForSlot(selectedAddSlot) : templatesMatchingSearch(mealLibrarySearchInput.value);
  if (!list.length) {
    mealPickListEl.innerHTML = `<p class="muted meal-pick-empty">No saved meals here yet. Save one in Meal library.</p>`;
    return;
  }
  mealPickListEl.innerHTML = list
    .map(
      (t) => `
    <button type="button" class="meal-pick-card" data-template-id="${t.id}">
      <span class="meal-pick-title">${t.icon || MEAL_SLOTS.find((s) => s.key === t.mealSlot)?.icon || "🍽️"} ${t.name}</span>
      <span class="meal-pick-meta">${t.calories} kcal${t.mealSlot ? ` · ${t.mealSlot}` : ""}</span>
    </button>
  `
    )
    .join("");
}

function applyTemplateToMealForm(template) {
  mealNameInput.value = template.name;
  mealCaloriesInput.value = String(template.calories);
  mealProteinInput.value = template.proteinG != null ? String(template.proteinG) : "";
  mealCarbsInput.value = template.carbsG != null ? String(template.carbsG) : "";
  mealWeightInput.value = template.defaultWeightGrams ? String(template.defaultWeightGrams) : "";
}

async function refreshMealTemplates() {
  if (!currentUser) {
    return;
  }
  const snapshot = await getDocs(getMealTemplatesCollection(currentUser.uid));
  mealTemplates = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  mealTemplates.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  renderMealTemplatesList();
  renderMealPickList();
}

function renderMealTemplatesList() {
  if (!mealTemplates.length) {
    templatesListEl.innerHTML = "<li><span>No saved meals yet.</span></li>";
    return;
  }
  templatesListEl.innerHTML = mealTemplates
    .map((template) => {
      const bits = [];
      if (template.proteinG != null && Number(template.proteinG) > 0) {
        bits.push(`P ${Number(template.proteinG).toFixed(0)}g`);
      }
      if (template.carbsG != null && Number(template.carbsG) > 0) {
        bits.push(`C ${Number(template.carbsG).toFixed(0)}g`);
      }
      const macro = bits.length ? ` · ${bits.join(" · ")}` : "";
      return `
      <li>
        <span>${template.icon || "🍽️"} ${template.name} <span class="muted">(${template.mealSlot || "Any"})</span></span>
        <strong>${template.calories} kcal${macro}</strong>
        <button class="delete-btn" data-template-id="${template.id}" type="button">Delete</button>
      </li>
    `;
    })
    .join("");
}

async function refreshMeals() {
  if (!currentUser) {
    return;
  }
  const dateKey = selectedDateKey;
  const mealsQuery = query(getMealsCollection(currentUser.uid), where("dateKey", "==", dateKey));
  const snapshot = await getDocs(mealsQuery);
  const meals = snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .sort((a, b) => String(a.createdAt?.seconds || 0) - String(b.createdAt?.seconds || 0));

  if (!meals.length) {
    mealsListEl.innerHTML = "<li><span>No meals logged yet for this date.</span></li>";
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
        <span>${meal.mealType}: ${meal.name}${meal.weightGrams ? ` (${meal.weightGrams}g)` : ""}${extraText}</span>
        <strong>${meal.calories} kcal</strong>
        <button class="delete-btn" data-meal-id="${meal.id}" type="button">Delete</button>
      </li>
    `;
    })
    .join("");
}

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "./index.html";
});

showAddViewBtn.addEventListener("click", () => setMealsView("add"));
showLibraryViewBtn.addEventListener("click", () => setMealsView("library"));

mealLibrarySearchInput.addEventListener("input", () => {
  if (addMealSource === "all") {
    renderMealPickList();
  }
});

mealSourceTabs.forEach((tab) => {
  tab.addEventListener("click", () => setAddMealSource(tab.dataset.source));
});

mealPickListEl.addEventListener("click", (event) => {
  const btn = event.target.closest(".meal-pick-card");
  if (!btn) {
    return;
  }
  const id = btn.dataset.templateId;
  const template = mealTemplates.find((t) => t.id === id);
  if (template) {
    applyTemplateToMealForm(template);
    showMessage(`Filled from “${template.name}”. Logged as ${selectedAddSlot}.`);
  }
});

templateForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentUser) {
    return;
  }
  const name = templateNameInput.value.trim();
  const calories = Number(templateCaloriesInput.value);
  const proteinG = templateProteinInput.value ? Number(templateProteinInput.value) : null;
  const carbsG = templateCarbsInput.value ? Number(templateCarbsInput.value) : null;
  const defaultWeightGrams = templateWeightInput.value ? Number(templateWeightInput.value) : null;
  const slot = MEAL_SLOTS.find((s) => s.key === selectedTemplateSlot);
  const icon = slot?.icon || "🍽️";

  if (!name || !Number.isFinite(calories) || calories <= 0) {
    showMessage("Please enter a valid saved meal.", "error");
    return;
  }
  if (proteinG !== null && (!Number.isFinite(proteinG) || proteinG < 0)) {
    showMessage("Protein must be valid.", "error");
    return;
  }
  if (carbsG !== null && (!Number.isFinite(carbsG) || carbsG < 0)) {
    showMessage("Carbs must be valid.", "error");
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
      proteinG,
      carbsG,
      defaultWeightGrams,
      mealSlot: selectedTemplateSlot,
      icon,
      createdAt: serverTimestamp(),
    });
    templateNameInput.value = "";
    templateCaloriesInput.value = "";
    templateProteinInput.value = "";
    templateCarbsInput.value = "";
    templateWeightInput.value = "";
    showMessage("Saved to your library.");
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

  const dateKey = selectedDateKey;
  const name = mealNameInput.value.trim();
  const mealType = selectedAddSlot;
  const calories = Number(mealCaloriesInput.value);
  const proteinG = mealProteinInput.value ? Number(mealProteinInput.value) : null;
  const carbsG = mealCarbsInput.value ? Number(mealCarbsInput.value) : null;
  const weightGrams = mealWeightInput.value ? Number(mealWeightInput.value) : null;

  if (!dateKey || !name || !Number.isFinite(calories) || calories <= 0) {
    showMessage("Please enter valid meal details.", "error");
    return;
  }
  if (proteinG !== null && (!Number.isFinite(proteinG) || proteinG < 0)) {
    showMessage("Protein must be valid.", "error");
    return;
  }
  if (carbsG !== null && (!Number.isFinite(carbsG) || carbsG < 0)) {
    showMessage("Carbs must be valid.", "error");
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
      proteinG,
      carbsG,
      weightGrams,
      createdAt: serverTimestamp(),
    });
    mealNameInput.value = "";
    mealCaloriesInput.value = "";
    mealProteinInput.value = "";
    mealCarbsInput.value = "";
    mealWeightInput.value = "";
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
  const initialDate = urlDateParam || localStorage.getItem(SELECTED_DATE_KEY_STORAGE) || getDateKey(today);
  selectedDateKey = initialDate;
  localStorage.setItem(SELECTED_DATE_KEY_STORAGE, selectedDateKey);
  todayDate.textContent = formatLongDate(new Date(`${selectedDateKey}T00:00:00`));

  const profileSnap = await getDoc(doc(db, "users", user.uid));
  const profile = profileSnap.exists() ? profileSnap.data() : {};
  const displayName = profile.firstName ? `${profile.firstName} ${profile.lastName || ""}`.trim() : user.email.split("@")[0];
  welcomeText.textContent = `Signed in as ${displayName}`;

  renderSlotBubbles(addSlotBubblesEl, selectedAddSlot, (slot) => {
    selectedAddSlot = slot;
    renderMealPickList();
  });
  renderSlotBubbles(templateSlotBubblesEl, selectedTemplateSlot, (slot) => {
    selectedTemplateSlot = slot;
  });

  setAddMealSource("slot");

  setMealsView("add");
  await refreshMealTemplates();
  await refreshMeals();
});
