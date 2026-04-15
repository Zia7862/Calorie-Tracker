import { createUserWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth } from "./firebase.js";

const signupForm = document.getElementById("signup-form");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const statusMessage = document.getElementById("status-message");

function showMessage(message, type = "success") {
  statusMessage.textContent = message;
  statusMessage.classList.remove("error", "success");
  statusMessage.classList.add(type);
}

function getFormData() {
  return {
    email: emailInput.value.trim(),
    password: passwordInput.value.trim(),
  };
}

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const { email, password } = getFormData();

  try {
    await createUserWithEmailAndPassword(auth, email, password);
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
