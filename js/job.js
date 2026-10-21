import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { auth, db, isConfigured } from "/js/firebase.js";
import { loadJob, esc, money } from "/js/data/jobs-data.js";

const root = document.getElementById("job-root");
const id = new URLSearchParams(location.search).get("id");
const icon = (n) =>
  `<svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-${n}"/></svg>`;
const fmt = (iso) =>
  iso
    ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

const messageState = (title, text) => {
  root.innerHTML = `<div class="empty-state"><span class="empty-state__icon">${icon("search-x")}</span>
    <h1 class="empty-state__title">${title}</h1><p class="empty-state__text">${text}</p>
    <a class="btn btn--dark btn--sm" href="/jobs">Browse open roles</a></div>`;
  root.removeAttribute("aria-busy");
};

const list = (title, items) =>
  items?.length
    ? `<section class="card job__section"><h2>${title}</h2><ul class="bullets">${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul></section>`
    : "";

function render({ job, preview }) {
  document.title = `${job.title} at ${job.company} — Hirely`;
  const salary = `${money(job.salaryMin)}–${money(job.salaryMax)}`;

  root.innerHTML = `
    ${preview ? `<p class="notice"><strong>Preview role.</strong> This demonstrates the role page. Applications open when teams publish real roles.</p>` : ""}
    <div class="job__layout">
      <div class="job__main">
        <header class="card job__head">
          <p class="eyebrow eyebrow--company">${esc(job.company)}</p>
          <h1 class="job__title">${esc(job.title)}</h1>
          <ul class="tags">
            <li class="tag">${esc(job.mode)}</li><li class="tag">${esc(job.type)}</li>
            ${job.category ? `<li class="tag">${esc(job.category)}</li>` : ""}
            ${preview ? '<li class="tag tag--warm">Preview</li>' : ""}
          </ul>
          <p class="job__meta"><span class="meta">${icon("map-pin")}${esc(job.location)}</span><span>Posted ${fmt(job.posted)}</span></p>
        </header>
        <section class="card job__section"><h2>Overview</h2><p>${esc(job.description)}</p></section>
        ${list("Responsibilities", job.responsibilities)}
        ${list("Requirements", job.requirements)}
        ${list("Benefits", job.benefits)}
      </div>

      <aside class="job__side" aria-label="Apply">
        <div class="card apply-card">
          <p class="apply-card__salary">${salary}</p>
          <p class="apply-card__hint">Annual salary range, shown up front.</p>
          <div id="apply-slot"></div>
          <p class="apply-card__error" id="apply-error" role="alert" hidden></p>
        </div>
        <dl class="card facts">
          <h2>Role facts</h2>
          <div><dt>Location</dt><dd>${esc(job.location)}</dd></div>
          <div><dt>Work mode</dt><dd>${esc(job.mode)}</dd></div>
          <div><dt>Employment</dt><dd>${esc(job.type)}</dd></div>
          <div><dt>Salary</dt><dd>${salary}</dd></div>
          <div><dt>Posted</dt><dd>${fmt(job.posted)}</dd></div>
        </dl>
      </aside>
    </div>`;
  root.removeAttribute("aria-busy");

  if (!preview) {
    const ld = document.createElement("script");
    ld.type = "application/ld+json";
    ld.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "JobPosting",
      title: job.title,
      description: job.description,
      datePosted: job.posted,
      hiringOrganization: { "@type": "Organization", name: job.company },
      jobLocation: { "@type": "Place", address: job.location },
      baseSalary: {
        "@type": "MonetaryAmount",
        currency: "USD",
        value: {
          "@type": "QuantitativeValue",
          minValue: job.salaryMin,
          maxValue: job.salaryMax,
          unitText: "YEAR",
        },
      },
    });
    document.head.append(ld);
  }
  setupApply(job, preview);
}

/* ---------- Apply ---------- */
function setupApply(job, preview) {
  const slot = document.getElementById("apply-slot");
  const errorBox = document.getElementById("apply-error");
  const button = (label, attrs = "") =>
    `<button class="btn btn--lime" type="button" id="apply-btn" ${attrs}>${label} ${icon("arrow-right")}</button>`;

  if (preview || !isConfigured) {
    slot.innerHTML = button("Apply now", "disabled");
    return;
  }

  onAuthStateChanged(auth, async (user) => {
    errorBox.hidden = true;
    if (!user) {
      const next = encodeURIComponent(location.pathname + location.search);
      slot.innerHTML = `<a class="btn btn--lime" href="/join?next=${next}">Sign in to apply ${icon("arrow-right")}</a>`;
      return;
    }
    const ref = doc(db, "applications", `${job.id}_${user.uid}`);
    try {
      if ((await getDoc(ref)).exists()) {
        slot.innerHTML = button("Application sent", "disabled");
        return;
      }
    } catch {
      /* fall through; the create call reports real problems */
    }

    slot.innerHTML = button("Apply now");
    document
      .getElementById("apply-btn")
      .addEventListener("click", async (e) => {
        const btn = e.currentTarget;
        btn.setAttribute("aria-busy", "true");
        btn.disabled = true;
        errorBox.hidden = true;
        try {
          await setDoc(ref, {
            jobId: job.id,
            jobTitle: job.title,
            company: job.company,
            applicantId: user.uid,
            status: "submitted",
            createdAt: serverTimestamp(),
          });
          slot.innerHTML = button("Application sent", "disabled");
        } catch {
          btn.removeAttribute("aria-busy");
          btn.disabled = false;
          errorBox.textContent =
            "We couldn’t send your application. Check your connection and try again.";
          errorBox.hidden = false;
        }
      });
  });
}

/* ---------- Boot ---------- */
loadJob(id)
  .then((result) =>
    result
      ? render(result)
      : messageState(
          "This role isn’t available",
          "It may have been closed, removed, or is still awaiting review.",
        ),
  )
  .catch(() =>
    messageState(
      "We couldn’t load this role",
      "Check your connection and try again.",
    ),
  );
