import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth } from "./firebase.js";

const authForm = document.getElementById("auth-form");
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

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const { email, password } = getFormData();

  try {
    await signInWithEmailAndPassword(auth, email, password);
    showMessage("Logged in successfully.");
    window.location.href = "./home.html";
  } catch (error) {
    showMessage(error.message, "error");
  }
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.href = "./home.html";
  } else {
    showMessage("You are signed out.");
  }
});
