import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getCountFromServer,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { db } from "/js/firebase.js";
import { initShell, esc, fmtDate } from "/js/app-shell.js";

initShell({ workspace: "admin", page: "overview" }).then(async () => {
  const show = (id, value) => {
    const el = document.getElementById(id);
    el.classList.remove("skeleton");
    el.textContent = value ?? "—";
  };

  const count = (q) => getCountFromServer(q).then((s) => s.data().count);
  const [people, jobs, apps, pending] = await Promise.allSettled([
    count(collection(db, "users")),
    count(collection(db, "jobs")),
    count(collection(db, "applications")),
    count(query(collection(db, "jobs"), where("status", "==", "pending"))),
  ]);
  const val = (r) => (r.status === "fulfilled" ? r.value : null);
  show("stat-people", val(people));
  show("stat-jobs", val(jobs));
  show("stat-apps", val(apps));
  show("awaiting-count", val(pending));

  const list = document.getElementById("recent-list");
  try {
    const snap = await getDocs(
      query(
        collection(db, "jobs"),
        where("status", "==", "pending"),
        orderBy("createdAt", "desc"),
        limit(3),
      ),
    );
    if (snap.empty) {
      list.innerHTML = `<div class="soft-block"><strong>The review queue is clear.</strong><p>New employer-submitted roles will be visible here.</p></div>`;
      return;
    }
    list.innerHTML = `<div class="review-list">${snap.docs
      .map((d) => {
        const j = d.data();
        return `<a class="review-row" href="/admin/moderation"><div><strong>${esc(j.title)}</strong><span>${esc(j.company)} · Submitted ${fmtDate(j.createdAt)}</span></div><span class="badge badge--warn">Pending</span></a>`;
      })
      .join("")}</div>`;
  } catch {
    list.innerHTML = `<div class="soft-block"><strong>We couldn’t load recent submissions.</strong><p>Check your connection and refresh the page.</p></div>`;
  }
});
