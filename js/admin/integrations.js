import {
  doc,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-functions.js";
import { db, functions } from "/js/firebase.js";
import { initShell, esc, icon, toast } from "/js/app-shell.js";

const PROVIDERS = {
  resend: {
    title: "Resend email",
    short: "Resend",
    icon: "mail",
    tint: "",
    desc: "Sends application, moderation, and interview messages.",
    help: "Verify a sending domain and sender in Resend before saving values.",
    link: ["Open Resend setup", "https://resend.com/domains"],
    save: "Save Resend settings",
    fields: [
      {
        key: "apiKey",
        chip: "API key",
        label: "Resend API key",
        type: "password",
        ph: "re_…",
        hint: "Use a sending-enabled API key. The saved value is never displayed.",
        check: (v) =>
          v.startsWith("re_") || "The API key should start with re_.",
      },
      {
        key: "sender",
        chip: "Sender",
        label: "Verified sender",
        type: "text",
        ph: "Hirely <notifications@yourdomain.com>",
        hint: "This sender must be verified in your Resend account.",
        check: (v) =>
          /@/.test(v) ||
          "Enter a sender such as Hirely <notifications@yourdomain.com>.",
      },
      {
        key: "appUrl",
        chip: "App URL",
        label: "Public app URL",
        type: "url",
        ph: "https://hirely.example.com",
        hint: "Used to create links in workflow emails. Do not include a trailing slash.",
        check: (v) =>
          (/^https?:\/\//.test(v) && !v.endsWith("/")) ||
          "Use a full URL starting with https:// and no trailing slash.",
      },
    ],
  },
  google_calendar: {
    title: "Google Calendar",
    short: "Calendar",
    icon: "calendar",
    tint: "integration__icon--sage",
    desc: "Checks employer availability and creates interview events.",
    help: "Create a Web Application OAuth client, enable the Calendar API, and register the exact redirect URI.",
    link: [
      "Open Google OAuth setup",
      "https://console.cloud.google.com/apis/credentials",
    ],
    save: "Save Calendar settings",
    fields: [
      {
        key: "clientId",
        chip: "Client ID",
        label: "OAuth client ID",
        type: "text",
        ph: "…apps.googleusercontent.com",
        hint: "From a Google Cloud Web Application OAuth client.",
        check: (v) =>
          v.endsWith(".apps.googleusercontent.com") ||
          "The client ID should end with .apps.googleusercontent.com.",
      },
      {
        key: "clientSecret",
        chip: "Secret",
        label: "OAuth client secret",
        type: "password",
        ph: "GOCSPX-…",
        hint: "The saved value is encrypted and never shown again.",
        check: (v) => v.length >= 10 || "That secret looks too short.",
      },
      {
        key: "redirectUri",
        chip: "Redirect URI",
        label: "Authorized redirect URI",
        type: "url",
        ph: "https://yourdomain.com/api/google-calendar/callback",
        hint: "Must exactly match the redirect URI registered in Google Cloud. It is never hardcoded.",
        check: (v) =>
          /^https?:\/\//.test(v) || "Use a full URL starting with https://.",
      },
    ],
  },
};

initShell({ workspace: "admin", page: "integrations" }).then(() => {
  const root = document.getElementById("integrations");
  const save = httpsCallable(functions, "saveIntegration");
  const remove = httpsCallable(functions, "removeIntegration");

  root.innerHTML = Object.entries(PROVIDERS)
    .map(
      ([id, p]) => `
    <article class="integration" data-provider="${id}" aria-labelledby="${id}-title">
      <div class="integration__head">
        <span class="integration__icon ${p.tint}" aria-hidden="true">${icon(p.icon)}</span>
        <div>
          <h2 class="integration__title" id="${id}-title">${esc(p.title)}</h2>
          <p class="integration__desc">${esc(p.desc)}</p>
        </div>
        <span class="badge badge--warn" data-role="status"><span class="badge__dot"></span><span data-role="status-text">${esc(p.short)} needs setup</span></span>
      </div>

      <ul class="chips" aria-label="Configuration readiness">
        ${p.fields.map((f) => `<li class="chip" data-chip="${f.key}"><span class="badge__dot"></span>${esc(f.chip)}<span class="chip__state">Missing</span></li>`).join("")}
      </ul>

      <p class="integration__help">${esc(p.help)}<br><a href="${p.link[1]}" target="_blank" rel="noopener noreferrer">${esc(p.link[0])} ${icon("external-link")}</a></p>

      <form class="integration__fields" novalidate autocomplete="off">
        ${p.fields
          .map(
            (f) => `
          <div class="field">
            <label class="field__label" for="${id}-${f.key}">${esc(f.label)}</label>
            <input class="input" id="${id}-${f.key}" name="${f.key}" type="${f.type}" placeholder="${esc(f.ph)}" autocomplete="off" aria-describedby="${id}-${f.key}-hint">
            <p class="field__hint" id="${id}-${f.key}-hint">${esc(f.hint)}</p>
          </div>`,
          )
          .join("")}
        <div class="integration__actions">
          <button class="btn btn--dark btn--sm" type="submit">${esc(p.save)} ${icon("check")}</button>
          <button class="btn btn--ghost-danger btn--sm" type="button" data-action="remove" disabled>${icon("trash")}Remove</button>
        </div>
      </form>
    </article>`,
    )
    .join("");

  /* Live readiness from integrationStatus/{provider} (booleans only — secrets never leave the server) */
  Object.entries(PROVIDERS).forEach(([id, p]) => {
    const card = root.querySelector(`[data-provider="${id}"]`);
    onSnapshot(
      doc(db, "integrationStatus", id),
      (snap) => {
        const fields = snap.exists() ? snap.data().fields || {} : {};
        let ready = 0;
        p.fields.forEach((f) => {
          const on = !!fields[f.key];
          ready += on;
          const chip = card.querySelector(`[data-chip="${f.key}"]`);
          chip.classList.toggle("chip--set", on);
          chip.querySelector(".chip__state").textContent = on
            ? "Set"
            : "Missing";
        });
        const all = ready === p.fields.length;
        const status = card.querySelector('[data-role="status"]');
        status.className = `badge ${all ? "badge--ok" : "badge--warn"}`;
        card.querySelector('[data-role="status-text"]').textContent = all
          ? `${p.short} connected`
          : `${p.short} needs setup`;
        card.querySelector('[data-action="remove"]').disabled = ready === 0;
      },
      () => toast("We couldn’t read integration status.", "error"),
    );
  });

  /* Save */
  root.addEventListener("submit", async (e) => {
    e.preventDefault();
    const card = e.target.closest("[data-provider]");
    const id = card.dataset.provider;
    const p = PROVIDERS[id];
    const btn = e.target.querySelector('[type="submit"]');

    const values = {};
    for (const f of p.fields) {
      const input = e.target.elements[f.key];
      const v = input.value.trim();
      if (!v) continue;
      const result = f.check(v);
      if (result !== true) {
        toast(result, "error");
        input.focus();
        return;
      }
      values[f.key] = v;
    }
    if (!Object.keys(values).length) {
      toast(
        "Nothing to save. Empty fields keep their existing values.",
        "error",
      );
      return;
    }

    btn.setAttribute("aria-busy", "true");
    try {
      await save({ provider: id, values });
      e.target.reset();
      toast(`${p.short} settings saved.`);
    } catch (err) {
      toast(
        err.message || "We couldn’t save those settings. Please try again.",
        "error",
      );
    } finally {
      btn.removeAttribute("aria-busy");
    }
  });

  /* Remove */
  root.addEventListener("click", async (e) => {
    const btn = e.target.closest('[data-action="remove"]');
    if (!btn) return;
    const id = btn.closest("[data-provider]").dataset.provider;
    const p = PROVIDERS[id];
    if (
      !confirm(
        `Remove all saved ${p.title} values? Emails or events that depend on them will stop until you save new ones.`,
      )
    )
      return;
    btn.setAttribute("aria-busy", "true");
    try {
      await remove({ provider: id });
      toast(`${p.short} settings removed.`);
    } catch {
      toast("We couldn’t remove those settings. Please try again.", "error");
    } finally {
      btn.removeAttribute("aria-busy");
    }
  });
});
