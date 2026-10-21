import { loadJobs } from "/js/data/jobs-data.js";
(() => {
  "use strict";

  const PAGE_SIZE = 6;
  const DETAIL_URL = (id) => `/job/?id=${encodeURIComponent(id)}`;

  /* ---------- Elements ---------- */
  const $ = (id) => document.getElementById(id);
  const el = {
    form: $("search-form"),
    q: $("f-q"),
    location: $("f-location"),
    category: $("f-category"),
    type: $("f-type"),
    salary: $("f-salary"),
    sort: $("f-sort"),
    reset: $("reset-filters"),
    grid: $("results-grid"),
    status: $("results-status"),
    prev: $("page-prev"),
    next: $("page-next"),
    pageLabel: $("page-label"),
  };

  const state = {
    q: "",
    location: "",
    category: "",
    type: "",
    salary: "",
    sort: "recent",
    page: 1,
  };
  let all = [];

  /* ---------- Helpers ---------- */
  const esc = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const k = (n) => `$${Math.round(n / 1000)}k`;
  const norm = (s) => s.toLowerCase().trim();
  const icon = (id) =>
    `<svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-${id}"/></svg>`;

  const matches = (job) => {
    if (state.q) {
      const hay = norm(
        [
          job.title,
          job.company,
          job.description,
          job.category,
          job.mode,
          job.type,
        ]
          .filter(Boolean)
          .join(" "),
      );
      if (
        !norm(state.q)
          .split(/\s+/)
          .every((word) => hay.includes(word))
      )
        return false;
    }
    if (state.location) {
      const loc = norm(state.location);
      const inLocation = norm(job.location).includes(loc);
      const isRemote = loc === "remote" && job.mode === "Remote";
      if (!inLocation && !isRemote) return false;
    }
    if (state.category && job.category !== state.category) return false;
    if (state.type && job.type !== state.type) return false;
    if (state.salary && job.salaryMax < Number(state.salary)) return false;
    return true;
  };

  const sorters = {
    recent: (a, b) => b.posted.localeCompare(a.posted),
    "salary-desc": (a, b) => b.salaryMax - a.salaryMax,
    "salary-asc": (a, b) => a.salaryMin - b.salaryMin,
  };

  /* ---------- Render ---------- */
  const cardHTML = (job, i) => `
    <li style="--i:${i}">
      <article class="card job-card">
        <div class="job-card__top">
          <div>
            <p class="eyebrow eyebrow--company">${esc(job.company)}</p>
            <h3 class="job-card__title"><a class="stretched-link" href="${DETAIL_URL(job.id)}">${esc(job.title)}</a></h3>
          </div>
          <span class="icon-btn" aria-hidden="true">${icon("arrow-right")}</span>
        </div>
        <p class="job-card__desc">${esc(job.description)}</p>
        <ul class="tags">
          <li class="tag">${esc(job.mode)}</li><li class="tag">${esc(job.type)}</li><li class="tag tag--warm">Preview</li>
        </ul>
        <footer class="job-card__foot">
          <span class="meta">${icon("map-pin")}${esc(job.location)}</span>
          <span class="salary">${k(job.salaryMin)}–${k(job.salaryMax)}</span>
        </footer>
      </article>
    </li>`;

  const emptyHTML = `
    <li>
      <div class="empty-state">
        <span class="empty-state__icon">${icon("search-x")}</span>
        <h3 class="empty-state__title">No roles match yet</h3>
        <p class="empty-state__text">Try a broader search, or clear a filter to see more of the directory.</p>
        <button class="btn btn--dark btn--sm" type="button" data-reset>Reset filters</button>
      </div>
    </li>`;

  const render = () => {
    const filtered = all.filter(matches).sort(sorters[state.sort]);
    const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    state.page = Math.min(state.page, pages);
    const slice = filtered.slice(
      (state.page - 1) * PAGE_SIZE,
      state.page * PAGE_SIZE,
    );

    el.grid.innerHTML = slice.length ? slice.map(cardHTML).join("") : emptyHTML;
    el.status.textContent = `${filtered.length} ${filtered.length === 1 ? "role" : "roles"} found`;
    el.pageLabel.textContent = `Page ${state.page} of ${pages}`;
    el.prev.disabled = state.page <= 1;
    el.next.disabled = state.page >= pages;
    syncURL();
  };

  /* ---------- URL <-> state ---------- */
  const syncURL = () => {
    const p = new URLSearchParams();
    Object.entries(state).forEach(([key, val]) => {
      if (
        val &&
        !(key === "sort" && val === "recent") &&
        !(key === "page" && val === 1)
      )
        p.set(key, val);
    });
    history.replaceState(null, "", p.toString() ? `?${p}` : location.pathname);
  };

  const readURL = () => {
    const p = new URLSearchParams(location.search);
    ["q", "location", "category", "type", "salary", "sort"].forEach((key) => {
      const v = p.get(key);
      if (v) state[key] = v;
    });
    const page = parseInt(p.get("page"), 10);
    if (page > 0) state.page = page;
    if (!sorters[state.sort]) state.sort = "recent";
    el.q.value = state.q;
    el.location.value = state.location;
    el.category.value = state.category;
    el.type.value = state.type;
    el.salary.value = state.salary;
    el.sort.value = state.sort;
  };

  /* ---------- Events ---------- */
  const debounce = (fn, ms = 200) => {
    let t;
    return (...a) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...a), ms);
    };
  };
  const update = (key, value) => {
    state[key] = value;
    state.page = 1;
    render();
  };

  el.form.addEventListener("submit", (e) => {
    e.preventDefault();
    update("q", el.q.value.trim());
  });
  el.q.addEventListener(
    "input",
    debounce(() => update("q", el.q.value.trim())),
  );
  el.location.addEventListener(
    "input",
    debounce(() => update("location", el.location.value.trim())),
  );
  ["category", "type", "salary", "sort"].forEach((key) =>
    el[key].addEventListener("change", () => update(key, el[key].value)),
  );

  const resetAll = () => {
    Object.assign(state, {
      q: "",
      location: "",
      category: "",
      type: "",
      salary: "",
      sort: "recent",
      page: 1,
    });
    el.q.value = el.location.value = "";
    el.category.value = el.type.value = el.salary.value = "";
    el.sort.value = "recent";
    render();
  };
  el.reset.addEventListener("click", resetAll);
  el.grid.addEventListener("click", (e) => {
    if (e.target.closest("[data-reset]")) resetAll();
  });

  el.prev.addEventListener("click", () => {
    state.page -= 1;
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  el.next.addEventListener("click", () => {
    state.page += 1;
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  /* ---------- Init ---------- */
  readURL();
  loadJobs()
    .then(({ jobs, preview }) => {
      all = jobs;
      document.getElementById("preview-notice").hidden = !preview;
      render();
    })
    .catch(() => {
      el.grid.innerHTML = `<li><div class="empty-state"><h3 class="empty-state__title">We couldn't load roles</h3>
      <p class="empty-state__text">Check your connection and try again.</p>
      <button class="btn btn--dark btn--sm" type="button" onclick="location.reload()">Try again</button></div></li>`;
    });
})();
