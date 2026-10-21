import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  doc,
  getDoc,
  addDoc,
  collection,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { auth, db, isConfigured } from "/js/firebase.js";

const $ = (id) => document.getElementById(id);
const gate = $("post-gate"),
  layout = $("post-layout"),
  form = $("post-form");
const success = $("post-success"),
  submit = $("post-submit"),
  formError = $("post-error");

const showGate = (title, text, action) => {
  layout.hidden = true;
  gate.hidden = false;
  gate.innerHTML = `<h2 class="empty-state__title">${title}</h2><p class="empty-state__text">${text}</p>${action || ""}`;
};

/* ---------- Validation: specific, next to the field, actionable ---------- */
const lines = (s) =>
  s
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 12)
    .map((l) => l.slice(0, 300));

function validate(v) {
  const e = {};
  if (v.title.length < 4)
    e.title =
      "Add a job title of at least 4 characters, such as “Senior Product Designer”.";
  if (v.company.length < 2)
    e.company = "Add the company name candidates will see.";
  if (!v.category) e.category = "Choose the category that fits this role best.";
  if (!v.type) e.type = "Choose an employment type.";
  if (!v.mode) e.mode = "Choose Remote, Hybrid, or On-site.";
  if (!v.location)
    e.location = "Add a location, or “Remote — US” for remote roles.";
  if (!Number.isFinite(v.salaryMin) || v.salaryMin < 1000)
    e.min = "Enter a minimum annual salary in USD, such as 145000.";
  if (!Number.isFinite(v.salaryMax) || v.salaryMax < 1000)
    e.max = "Enter a maximum annual salary in USD, such as 170000.";
  else if (Number.isFinite(v.salaryMin) && v.salaryMax < v.salaryMin)
    e.max = "The maximum should be at least as high as the minimum.";
  if (v.description.length < 40)
    e.description = `Write at least 40 characters so candidates understand the role (${v.description.length} so far).`;
  return e;
}

const FIELD_FOR = {
  title: "p-title",
  company: "p-company",
  category: "p-category",
  type: "p-type",
  mode: "p-mode",
  location: "p-location",
  min: "p-min",
  max: "p-max",
  description: "p-description",
};

function showErrors(errors) {
  Object.entries(FIELD_FOR).forEach(([key, inputId]) => {
    const input = $(inputId),
      msg = $(`e-${key}`);
    const text = errors[key];
    msg.hidden = !text;
    msg.textContent = text || "";
    if (text) input.setAttribute("aria-invalid", "true");
    else input.removeAttribute("aria-invalid");
  });
  const first = Object.keys(errors)[0];
  if (first) $(FIELD_FOR[first]).focus();
}

/* ---------- Auth gate ---------- */
let currentUser = null,
  currentProfile = null;

if (!isConfigured) {
  showGate(
    "Sign-in isn’t connected yet",
    "Add your Firebase config in js/firebase-config.js to post roles.",
  );
} else {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      showGate(
        "Sign in to post a role",
        "You need an employer account to submit roles for review.",
        `<a class="btn btn--dark btn--sm" href="/join?role=employer&next=/post/">Sign in</a>`,
      );
      return;
    }
    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      currentProfile = snap.exists() ? snap.data() : null;
    } catch {
      showGate(
        "We couldn’t verify your account",
        "Check your connection and try again.",
        `<button class="btn btn--dark btn--sm" type="button" onclick="location.reload()">Try again</button>`,
      );
      return;
    }
    if (
      !currentProfile ||
      !["employer", "admin"].includes(currentProfile.role)
    ) {
      showGate(
        "Employer accounts only",
        "This account is registered as a candidate. Roles can only be posted from an employer account.",
        `<a class="btn btn--dark btn--sm" href="/jobs">Browse roles</a>`,
      );
      return;
    }
    currentUser = user;
    gate.hidden = true;
    layout.hidden = false;
  });
}

/* ---------- Submit ---------- */
form.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  formError.hidden = true;
  const f = form.elements;
  const values = {
    title: f.title.value.trim(),
    company: f.company.value.trim(),
    category: f.category.value,
    type: f.type.value,
    mode: f.mode.value,
    location: f.location.value.trim(),
    salaryMin: parseInt(f.salaryMin.value, 10),
    salaryMax: parseInt(f.salaryMax.value, 10),
    description: f.description.value.trim(),
  };
  const errors = validate(values);
  showErrors(errors);
  if (Object.keys(errors).length || !currentUser) return;

  submit.setAttribute("aria-busy", "true");
  try {
    await addDoc(collection(db, "jobs"), {
      ...values,
      responsibilities: lines(f.responsibilities.value),
      requirements: lines(f.requirements.value),
      benefits: lines(f.benefits.value),
      status: "pending",
      ownerId: currentUser.uid,
      ownerName: currentProfile.name || "",
      createdAt: serverTimestamp(),
    });
    layout.hidden = true;
    success.hidden = false;
    success.scrollIntoView({ behavior: "smooth", block: "center" });
  } catch {
    formError.textContent =
      "We couldn’t submit your role. Check your connection and try again. Your details are still on this page.";
    formError.hidden = false;
  } finally {
    submit.removeAttribute("aria-busy");
  }
});

/* Clear a field's error as soon as the person fixes it */
form.addEventListener("input", (e) => {
  const key = Object.keys(FIELD_FOR).find((k) => FIELD_FOR[k] === e.target.id);
  if (key) {
    $(`e-${key}`).hidden = true;
    e.target.removeAttribute("aria-invalid");
  }
});
