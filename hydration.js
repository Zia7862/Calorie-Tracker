import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { addDoc, collection, deleteDoc, doc, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { auth, db, serverTimestamp } from "./firebase.js";

const welcomeText = document.getElementById("welcome-text");
const todayDate = document.getElementById("today-date");
const logoutBtn = document.getElementById("logout-btn");
const statusMessage = document.getElementById("status-message");
const waterForm = document.getElementById("water-form");
const waterDateInput = document.getElementById("water-date");
const waterAmountInput = document.getElementById("water-amount");
const waterTotal = document.getElementById("water-total");
const waterList = document.getElementById("water-list");

let currentUser = null;

const getDateKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const getOrdinal = (day) => (day > 3 && day < 21 ? "th" : ["th", "st", "nd", "rd"][day % 10] || "th");
const formatLongDate = (d) =>
  `${d.toLocaleDateString(undefined, { weekday: "long" })} the ${d.getDate()}${getOrdinal(d.getDate())} ${d.toLocaleDateString(undefined, { month: "long" })} ${d.getFullYear()}`;

function showMessage(message, type = "success") {
  statusMessage.textContent = message;
  statusMessage.classList.remove("error", "success");
  statusMessage.classList.add(type);
}

function hydrationCollection(uid) {
  return collection(db, "users", uid, "hydrationLogs");
}

async function refreshHydration() {
  const dateKey = waterDateInput.value;
  const q = query(hydrationCollection(currentUser.uid), where("dateKey", "==", dateKey));
  const snap = await getDocs(q);
  const entries = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const totalMl = entries.reduce((sum, e) => sum + (Number(e.amountMl) || 0), 0);
  waterTotal.textContent = `${(totalMl / 1000).toFixed(1)} L`;

  if (!entries.length) {
    waterList.innerHTML = "<li><span>No hydration entries yet for this date.</span></li>";
    return;
  }
  waterList.innerHTML = entries
    .map((e) => `<li><span>${e.amountMl} ml</span><strong>${e.dateKey}</strong><button class="delete-btn" data-id="${e.id}" type="button">Delete</button></li>`)
    .join("");
}

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "./index.html";
});

waterDateInput.addEventListener("change", () => refreshHydration().catch((e) => showMessage(e.message, "error")));

waterForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const amountMl = Number(waterAmountInput.value);
  if (!waterDateInput.value || !Number.isFinite(amountMl) || amountMl <= 0) {
    showMessage("Please enter a valid hydration amount.", "error");
    return;
  }
  try {
    await addDoc(hydrationCollection(currentUser.uid), {
      amountMl,
      dateKey: waterDateInput.value,
      createdAt: serverTimestamp(),
    });
    waterAmountInput.value = "";
    showMessage("Hydration entry saved.");
    await refreshHydration();
  } catch (error) {
    showMessage(error.message, "error");
  }
});

waterList.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }
  const id = target.dataset.id;
  if (!id) {
    return;
  }
  try {
    await deleteDoc(doc(db, "users", currentUser.uid, "hydrationLogs", id));
    showMessage("Entry deleted.");
    await refreshHydration();
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
  waterDateInput.value = getDateKey(today);
  welcomeText.textContent = `Signed in as ${user.email.split("@")[0]}`;
  await refreshHydration();
});
