import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { auth, db, isConfigured } from "/js/firebase.js";

/* ---------- Workspace registry (employer + candidate get added here later) ---------- */
const WORKSPACES = {
  admin: {
    label: "Administrator",
    role: "admin",
    eyebrow: "Administrator",
    nav: [
      {
        id: "overview",
        label: "Overview",
        href: "/admin",
        icon: "layout-dashboard",
        title: "Platform overview",
      },
      {
        id: "moderation",
        label: "Moderation queue",
        href: "/admin/moderation",
        icon: "clipboard-check",
        title: "Job moderation",
      },
      {
        id: "users",
        label: "Users",
        href: "/admin/users",
        icon: "users",
        title: "User management",
      },
      {
        id: "integrations",
        label: "Integrations",
        href: "/admin/integrations",
        icon: "settings",
        title: "Integration settings",
      },
    ],
  },
};

/* ---------- Utilities (exported for page scripts) ---------- */
export const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const icon = (id) =>
  `<svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-${id}"/></svg>`;
export const fmtDate = (ts) =>
  (ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null)?.toLocaleDateString(
    "en-US",
  ) ?? "—";
export const money = (n) => `$${Math.round(n / 1000)}k`;

let toastRegion;
export function toast(message, type = "ok") {
  if (!toastRegion) {
    toastRegion = Object.assign(document.createElement("div"), {
      className: "toast-region",
    });
    toastRegion.setAttribute("role", "status");
    toastRegion.setAttribute("aria-live", "polite");
    document.body.append(toastRegion);
  }
  const el = Object.assign(document.createElement("p"), {
    className: `toast${type === "error" ? " toast--error" : ""}`,
    textContent: message,
  });
  toastRegion.append(el);
  setTimeout(() => el.remove(), 4200);
}

/* ---------- Shell rendering ---------- */
function renderShell(cfg, page) {
  const current = cfg.nav.find((n) => n.id === page);
  document.title = `${current.title} — Hirely`;

  document.getElementById("app-sidebar").innerHTML = `
    <a class="app-brand" href="/" aria-label="Hirely home">
      <span class="logo__mark" aria-hidden="true">h.</span>
      <span class="app-brand__text"><span class="app-brand__name">hirely</span><span class="app-brand__role">${esc(cfg.label)}</span></span>
    </a>
    <nav class="app-nav" aria-label="${esc(cfg.label)}">
      ${cfg.nav.map((n) => `<a href="${n.href}"${n.id === page ? ' aria-current="page"' : ""}>${icon(n.icon)}${esc(n.label)}</a>`).join("")}
    </nav>
    <div class="app-sidebar__foot">
      <a class="app-back" href="/">${icon("chevron-left")}Back to marketplace</a>
      <div class="app-user">
        <span class="app-user__avatar" id="app-avatar" aria-hidden="true"></span>
        <span class="app-user__text"><span class="app-user__name" id="app-name"></span><span class="app-user__role">${esc(cfg.label)}</span></span>
      </div>
    </div>`;

  document.getElementById("app-topbar").innerHTML = `
    <div class="app-topbar__left">
      <button class="app-toggle" type="button" id="app-toggle" aria-controls="app-sidebar" aria-expanded="false" aria-label="Open navigation">${icon("panel-left")}</button>
      <div>
        <p class="app-topbar__eyebrow">${esc(cfg.eyebrow)}</p>
        <h1 class="app-topbar__title">${esc(current.title)}</h1>
      </div>
    </div>
    <p class="app-topbar__tag"><strong>A more deliberate way to work</strong><span>Keep your next move focused.</span></p>`;

  bindDrawer();
}

function bindDrawer() {
  const sidebar = document.getElementById("app-sidebar");
  const scrim = document.getElementById("app-scrim");
  const toggle = document.getElementById("app-toggle");
  const set = (open) => {
    sidebar.classList.toggle("is-open", open);
    scrim.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
  };
  toggle.addEventListener("click", () =>
    set(!sidebar.classList.contains("is-open")),
  );
  scrim.addEventListener("click", () => set(false));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      set(false);
    }
  });
  sidebar.addEventListener("click", (e) => {
    if (e.target.closest("a")) set(false);
  });
}

function fillUser(user, profile) {
  const name = profile.name || user.displayName || "Account";
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  document.getElementById("app-name").textContent = name;
  document.getElementById("app-avatar").textContent = initials;
}

function deny(cause) {
  const copy = {
    config: [
      "Firebase isn’t connected yet",
      "Add your project config in js/firebase-config.js to open this workspace.",
      "Back to marketplace",
      "/",
    ],
    role: [
      "Administrator access only",
      "This workspace is limited to administrator accounts. If you should have access, ask a platform administrator.",
      "Back to marketplace",
      "/",
    ],
    error: [
      "We couldn’t verify your access",
      "Check your connection and try again.",
      "Try again",
      null,
    ],
  }[cause];
  document.getElementById("app-main").innerHTML = `
    <div class="empty-state empty-state--panel">
      <span class="empty-state__icon">${icon("shield-check")}</span>
      <h2 class="empty-state__title">${copy[0]}</h2>
      <p class="empty-state__text">${copy[1]}</p>
      ${copy[3] ? `<a class="btn btn--dark btn--sm" href="${copy[3]}">${copy[2]}</a>` : `<button class="btn btn--dark btn--sm" type="button" onclick="location.reload()">${copy[2]}</button>`}
    </div>`;
  document.getElementById("app-main").removeAttribute("aria-busy");
}

/* ---------- Entry point: resolves only for a verified user of the right role ---------- */
export function initShell({ workspace, page }) {
  const cfg = WORKSPACES[workspace];
  renderShell(cfg, page);
  const main = document.getElementById("app-main");

  return new Promise((resolve) => {
    if (!isConfigured) {
      deny("config");
      return;
    }
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        location.replace(`/join?next=${encodeURIComponent(location.pathname)}`);
        return;
      }
      let profile;
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        profile = snap.exists() ? snap.data() : null;
      } catch {
        deny("error");
        return;
      }
      if (!profile || profile.role !== cfg.role) {
        deny("role");
        return;
      }
      fillUser(user, profile);
      main.removeAttribute("aria-busy");
      resolve({ user, profile });
    });
  });
}
