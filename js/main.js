(() => {
  "use strict";

  /* ---------- Mobile menu (shared header) ---------- */
  const toggle = document.querySelector(".menu-toggle");
  const menu = document.getElementById("site-menu");

  if (toggle && menu) {
    const setOpen = (open) => {
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      menu.classList.toggle("is-open", open);
    };

    toggle.addEventListener("click", () =>
      setOpen(toggle.getAttribute("aria-expanded") !== "true"),
    );

    menu.addEventListener("click", (e) => {
      if (e.target.closest("a")) setOpen(false);
    });

    document.addEventListener("keydown", (e) => {
      if (
        e.key === "Escape" &&
        toggle.getAttribute("aria-expanded") === "true"
      ) {
        setOpen(false);
        toggle.focus();
      }
    });

    document.addEventListener("click", (e) => {
      if (!e.target.closest(".site-header__inner")) setOpen(false);
    });

    window
      .matchMedia("(min-width: 48.01rem)")
      .addEventListener("change", (m) => {
        if (m.matches) setOpen(false);
      });
  }

  /* ---------- Scroll reveal ---------- */
  const items = document.querySelectorAll(".reveal");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!("IntersectionObserver" in window) || reduce) {
    items.forEach((el) => el.classList.add("is-visible"));
  } else {
    // Stagger siblings that share a parent so grids cascade in
    const seen = new Map();
    items.forEach((el) => {
      const parent = el.parentElement;
      const i = seen.get(parent) ?? 0;
      el.style.setProperty("--delay", `${Math.min(i, 4) * 90}ms`);
      seen.set(parent, i + 1);
    });

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -6% 0px" },
    );

    items.forEach((el) => io.observe(el));
  }

  /* ---------- Search: don't send empty params ---------- */
  const search = document.querySelector('form[role="search"]:not([data-live])');
  if (search) {
    search.addEventListener("submit", () => {
      search.querySelectorAll("input, select").forEach((field) => {
        if (!field.value.trim()) field.disabled = true; // omitted from the query string
      });
    });
    window.addEventListener("pageshow", () => {
      search.querySelectorAll("input, select").forEach((field) => {
        field.disabled = false;
      });
    });
  }
})();
