import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { db } from "/js/firebase.js";
import { initShell, esc, fmtDate } from "/js/app-shell.js";

initShell({ workspace: "admin", page: "users" }).then(async () => {
  const body = document.getElementById("users-body");
  const label = (r) => (r ? r.charAt(0).toUpperCase() + r.slice(1) : "Member");

  try {
    const snap = await getDocs(
      query(collection(db, "users"), orderBy("createdAt", "desc"), limit(100)),
    );
    body.innerHTML = snap.empty
      ? `<tr><td colspan="3">No accounts yet.</td></tr>`
      : snap.docs
          .map((d) => {
            const u = d.data();
            return `<tr>
            <td><span class="cell-main">${esc(u.name || "Unnamed account")}</span><span class="cell-sub">${esc(u.email || "")}</span></td>
            <td><span class="badge">${esc(label(u.role))}</span></td>
            <td>${fmtDate(u.createdAt)}</td>
          </tr>`;
          })
          .join("");
  } catch {
    body.innerHTML = `<tr><td colspan="3">We couldn’t load accounts. Check your connection and refresh.</td></tr>`;
  }
});
