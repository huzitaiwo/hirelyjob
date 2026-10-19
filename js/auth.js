import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

const btn = document.getElementById("auth-btn");
const label = document.getElementById("auth-btn-label");
const errorBox = document.getElementById("auth-error");

const NEXT_URL = "/jobs"; // becomes role-based once the workspaces exist

// Remember which path the visitor chose on the landing page (?role=candidate | employer)
const role = new URLSearchParams(location.search).get("role");
if (role === "candidate" || role === "employer") {
  try {
    localStorage.setItem("hirely:role", role);
  } catch {
    /* storage unavailable */
  }
}

const showError = (msg) => {
  errorBox.textContent = msg;
  errorBox.hidden = false;
};
const clearError = () => {
  errorBox.hidden = true;
  errorBox.textContent = "";
};

const configured = !String(firebaseConfig.apiKey).startsWith("YOUR_");

if (!configured) {
  btn.addEventListener("click", () =>
    showError(
      "Sign-in is not connected yet. Add your Firebase config in js/firebase-config.js.",
    ),
  );
} else {
  const auth = getAuth(initializeApp(firebaseConfig));
  const provider = new GoogleAuthProvider();

  onAuthStateChanged(auth, (user) => {
    if (user) label.textContent = "Continue to Hirely";
  });

  btn.addEventListener("click", async () => {
    clearError();
    if (auth.currentUser) {
      location.href = NEXT_URL;
      return;
    }

    btn.setAttribute("aria-busy", "true");
    label.textContent = "Connecting…";
    try {
      await signInWithPopup(auth, provider);
      location.href = NEXT_URL;
    } catch (err) {
      const messages = {
        "auth/popup-closed-by-user":
          "The sign-in window was closed before finishing. Try again when you are ready.",
        "auth/popup-blocked":
          "Your browser blocked the sign-in window. Allow pop-ups for this site and try again.",
        "auth/network-request-failed":
          "We could not reach the sign-in service. Check your connection and try again.",
      };
      showError(
        messages[err.code] ||
          "Something went wrong while signing you in. Please try again.",
      );
      label.textContent = "Continue with Google";
    } finally {
      btn.removeAttribute("aria-busy");
    }
  });
}
