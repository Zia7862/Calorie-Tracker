import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC8Zas1GixLKp3L46sn2AVAz0HPAytJV48",
  authDomain: "calorietracker-3c69f.firebaseapp.com",
  projectId: "calorietracker-3c69f",
  storageBucket: "calorietracker-3c69f.firebasestorage.app",
  messagingSenderId: "906236419074",
  appId: "1:906236419074:web:bc454dadf1ed35d82c5b1b",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db, serverTimestamp };
