import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { db } from "/js/firebase.js";
import { initShell, esc, icon, fmtDate, money, toast } from "/js/app-shell.js";

const EMPTY = {
  pending: ["No pending roles.", "This queue is currently clear."],
  approved: [
    "No approved roles yet.",
    "Roles you approve will be listed here once they are live.",
  ],
  rejected: [
    "No rejected roles.",
    "Roles returned with a reason will be listed here.",
  ],
};

initShell({ workspace: "admin", page: "moderation" }).then(({ user }) => {
  const panel = document.getElementById("queue");
  const tabs = [...document.querySelectorAll(".tab")];
  const dialog = document.getElementById("reject-dialog");
  const form = document.getElementById("reject-form");
  const reason = document.getElementById("reject-reason");
  const reasonError = document.getElementById("reject-error");
  let status = "pending";
  let rejectingId = null;

  const emptyHTML = (s) => `
    <div class="empty-state empty-state--panel">
      <span class="empty-state__icon">${icon("shield-check")}</span>
      <h3 class="empty-state__title">${EMPTY[s][0]}</h3>
      <p class="empty-state__text">${EMPTY[s][1]}</p>
    </div>`;

  const cardHTML = (id, j, s) => `
    <article class="review-card" data-id="${id}">
      <div class="review-card__body">
        <p class="eyebrow eyebrow--company">${esc(j.company)}</p>
        <h3 class="review-card__title">${esc(j.title)}</h3>
        <p class="review-card__desc">${esc(j.description)}</p>
        <ul class="tags"><li class="tag">${esc(j.mode)}</li><li class="tag">${esc(j.type)}</li></ul>
        <p class="review-card__meta">${esc(j.location)} · ${money(j.salaryMin)}–${money(j.salaryMax)} · Submitted ${fmtDate(j.createdAt)}</p>
        ${s === "rejected" && j.reviewNote ? `<p class="review-card__reason"><strong>Returned:</strong> ${esc(j.reviewNote)}</p>` : ""}
      </div>
      <div class="review-card__actions">
        ${
          s === "pending"
            ? `
          <button class="btn btn--dark btn--sm" type="button" data-action="approve">Approve ${icon("check")}</button>
          <button class="btn btn--outline btn--sm" type="button" data-action="reject">Return</button>`
            : s === "approved"
              ? `<span class="badge badge--ok">Approved</span>`
              : `<span class="badge badge--bad">Rejected</span>`
        }
      </div>
    </article>`;

  async function load() {
    panel.setAttribute("aria-busy", "true");
    panel.innerHTML = `<div class="soft-block"><strong>Loading roles…</strong></div>`;
    try {
      const snap = await getDocs(
        query(
          collection(db, "jobs"),
          where("status", "==", status),
          orderBy("createdAt", "desc"),
          limit(50),
        ),
      );
      panel.innerHTML = snap.empty
        ? emptyHTML(status)
        : snap.docs.map((d) => cardHTML(d.id, d.data(), status)).join("");
    } catch (err) {
      console.error(err); // first run: Firestore prints a link to create the status+createdAt index
      panel.innerHTML = `<div class="empty-state empty-state--panel"><h3 class="empty-state__title">We couldn’t load this queue</h3>
        <p class="empty-state__text">Check your connection and try again.</p>
        <button class="btn btn--dark btn--sm" type="button" data-action="retry">Try again</button></div>`;
    } finally {
      panel.removeAttribute("aria-busy");
    }
  }

  /* Tabs (arrow-key navigation) */
  const select = (tab) => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute("aria-selected", on);
      t.tabIndex = on ? 0 : -1;
    });
    panel.setAttribute("aria-labelledby", tab.id);
    status = tab.dataset.status;
    load();
  };
  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => select(tab));
    tab.addEventListener("keydown", (e) => {
      const next = {
        ArrowRight: i + 1,
        ArrowLeft: i - 1,
        Home: 0,
        End: tabs.length - 1,
      }[e.key];
      if (next === undefined) return;
      e.preventDefault();
      const target = tabs[(next + tabs.length) % tabs.length];
      target.focus();
      select(target);
    });
  });

  /* Actions */
  const review = async (id, data, okMessage, btn) => {
    btn?.setAttribute("aria-busy", "true");
    try {
      await updateDoc(doc(db, "jobs", id), {
        ...data,
        reviewedBy: user.uid,
        reviewedAt: serverTimestamp(),
      });
      toast(okMessage);
      load();
    } catch {
      toast("We couldn’t save that decision. Please try again.", "error");
      btn?.removeAttribute("aria-busy");
    }
  };

  panel.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const id = btn.closest(".review-card")?.dataset.id;
    if (btn.dataset.action === "retry") load();
    if (btn.dataset.action === "approve")
      review(
        id,
        { status: "approved", reviewNote: null },
        "Role approved and published.",
        btn,
      );
    if (btn.dataset.action === "reject") {
      rejectingId = id;
      reason.value = "";
      reasonError.hidden = true;
      dialog.showModal();
      reason.focus();
    }
  });

  document
    .getElementById("reject-cancel")
    .addEventListener("click", () => dialog.close());
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = reason.value.trim();
    if (text.length < 10) {
      reasonError.textContent =
        "Add a reason of at least 10 characters so the employer knows what to fix.";
      reasonError.hidden = false;
      reason.focus();
      return;
    }
    dialog.close();
    review(
      rejectingId,
      { status: "rejected", reviewNote: text },
      "Role returned to the employer.",
    );
  });

  load();
});
