import {
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { auth, db, isConfigured } from "./firebase.js";

const btn = document.getElementById("auth-btn");
const label = document.getElementById("auth-btn-label");
const errorBox = document.getElementById("auth-error");

const params = new URLSearchParams(location.search);
const role = params.get("role");
if (role === "candidate" || role === "employer") {
  try {
    localStorage.setItem("hirely:role", role);
  } catch {
    /* storage unavailable */
  }
}

// Only same-site paths are allowed as a post-login destination
const next = params.get("next");
const NEXT_URL =
  next && next.startsWith("/") && !next.startsWith("//") ? next : "/jobs";

const showError = (msg) => {
  errorBox.textContent = msg;
  errorBox.hidden = false;
};
const clearError = () => {
  errorBox.hidden = true;
  errorBox.textContent = "";
};

async function ensureProfile(user) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  let chosen = "candidate";
  try {
    if (localStorage.getItem("hirely:role") === "employer") chosen = "employer";
  } catch {
    /* ignore */
  }
  await setDoc(ref, {
    name: user.displayName || user.email.split("@")[0],
    email: user.email,
    role: chosen,
    createdAt: serverTimestamp(),
  });
}

if (!isConfigured) {
  btn.addEventListener("click", () =>
    showError(
      "Sign-in is not connected yet. Add your Firebase config in js/firebase-config.js.",
    ),
  );
} else {
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
      const { user } = await signInWithPopup(auth, provider);
      await ensureProfile(user);
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
