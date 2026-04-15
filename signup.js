import { createUserWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { auth, db, serverTimestamp } from "./firebase.js";

const signupForm = document.getElementById("signup-form");
const firstNameInput = document.getElementById("first-name");
const lastNameInput = document.getElementById("last-name");
const ageInput = document.getElementById("age");
const heightCmInput = document.getElementById("height-cm");
const currentWeightKgInput = document.getElementById("current-weight-kg");
const goalWeightKgInput = document.getElementById("goal-weight-kg");
const goalTimelineDateInput = document.getElementById("goal-timeline-date");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const statusMessage = document.getElementById("status-message");

const todayKey = new Date().toISOString().split("T")[0];
goalTimelineDateInput.min = todayKey;

function showMessage(message, type = "success") {
  statusMessage.textContent = message;
  statusMessage.classList.remove("error", "success");
  statusMessage.classList.add(type);
}

function getFormData() {
  return {
    firstName: firstNameInput.value.trim(),
    lastName: lastNameInput.value.trim(),
    age: Number(ageInput.value),
    heightCm: Number(heightCmInput.value),
    currentWeightKg: Number(currentWeightKgInput.value),
    goalWeightKg: Number(goalWeightKgInput.value),
    goalTimelineDate: goalTimelineDateInput.value,
    email: emailInput.value.trim(),
    password: passwordInput.value.trim(),
  };
}

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const {
    firstName,
    lastName,
    age,
    heightCm,
    currentWeightKg,
    goalWeightKg,
    goalTimelineDate,
    email,
    password,
  } = getFormData();

  if (!firstName || !lastName) {
    showMessage("Please enter your first name and surname.", "error");
    return;
  }
  if (!Number.isFinite(age) || age < 13 || age > 100) {
    showMessage("Please enter a valid age.", "error");
    return;
  }
  if (!Number.isFinite(heightCm) || heightCm < 120 || heightCm > 250) {
    showMessage("Please enter a valid height.", "error");
    return;
  }
  if (!Number.isFinite(currentWeightKg) || currentWeightKg < 30 || currentWeightKg > 300) {
    showMessage("Please enter a valid current weight.", "error");
    return;
  }
  if (!Number.isFinite(goalWeightKg) || goalWeightKg < 30 || goalWeightKg > 300) {
    showMessage("Please enter a valid goal weight.", "error");
    return;
  }
  if (!goalTimelineDate || goalTimelineDate < todayKey) {
    showMessage("Please choose a valid goal timeline date.", "error");
    return;
  }

  try {
    const credentials = await createUserWithEmailAndPassword(auth, email, password);
    const { uid } = credentials.user;

    await setDoc(doc(db, "users", uid), {
      email,
      firstName,
      lastName,
      age,
      heightCm,
      startWeightKg: currentWeightKg,
      currentWeightKg,
      goalWeightKg,
      goalTimelineDate,
      profileCompleted: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    showMessage("Account created successfully.");
    window.location.href = "./home.html";
  } catch (error) {
    showMessage(error.message, "error");
  }
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.href = "./home.html";
  }
});
