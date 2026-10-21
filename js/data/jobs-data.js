import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { db, isConfigured } from "/js/firebase.js";

export const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const money = (n) => `$${Math.round(n / 1000)}k`;

/* Demo roles shown until real approved roles exist */
export const PREVIEW_JOBS = [
  {
    id: "aster-field-senior-product-designer",
    company: "Aster & Field",
    title: "Senior Product Designer",
    description:
      "Shape thoughtful digital tools for people building a better financial life.",
    mode: "Hybrid",
    type: "Full-Time",
    category: "Design",
    location: "New York, NY",
    salaryMin: 145000,
    salaryMax: 170000,
    posted: "2026-10-12",
    responsibilities: [
      "Lead end-to-end design for core money-management experiences, from discovery to launch.",
      "Turn research and data into clear product decisions and testable prototypes.",
      "Partner with engineering and product on a shared design system.",
      "Mentor designers and raise the craft bar across the team.",
    ],
    requirements: [
      "6+ years designing digital products, with a portfolio that shows your decisions.",
      "Fluency in Figma and interaction prototyping.",
      "Experience contributing to a design system at scale.",
      "Clear written and verbal communication.",
    ],
    benefits: [
      "Health, dental, and vision coverage",
      "Hybrid schedule with two office days",
      "Annual learning budget",
      "Flexible time off",
    ],
  },
  {
    id: "kiteworks-platform-engineer",
    company: "Kiteworks",
    title: "Platform Engineer",
    description:
      "Build reliable systems that let ambitious teams move with confidence.",
    mode: "Remote",
    type: "Full-Time",
    category: "Engineering",
    location: "Remote — US",
    salaryMin: 155000,
    salaryMax: 190000,
    posted: "2026-10-10",
    responsibilities: [
      "Design and run the infrastructure that product teams deploy on.",
      "Improve deployment speed, observability, and incident response.",
      "Automate repetitive operational work with well-tested tooling.",
      "Document systems so other engineers can own them confidently.",
    ],
    requirements: [
      "5+ years in platform, SRE, or infrastructure engineering.",
      "Hands-on experience with containers, CI/CD, and a major cloud provider.",
      "Comfort writing production code in at least one language such as Go or TypeScript.",
      "A calm, methodical approach to incidents.",
    ],
    benefits: [
      "Fully remote within the US",
      "Home-office stipend",
      "Health coverage",
      "Quarterly team gatherings",
    ],
  },
  {
    id: "morrow-studio-lifecycle-growth-lead",
    company: "Morrow Studio",
    title: "Lifecycle Growth Lead",
    description:
      "Make every customer moment clearer, more useful, and more human.",
    mode: "Hybrid",
    type: "Full-Time",
    category: "Marketing",
    location: "Austin, TX",
    salaryMin: 125000,
    salaryMax: 150000,
    posted: "2026-10-08",
    responsibilities: [
      "Own the customer journey from onboarding through retention and re-engagement.",
      "Plan, run, and measure experiments across email, in-app, and push.",
      "Work with design and data to turn insight into better messaging.",
      "Report on what is working and what is not, honestly.",
    ],
    requirements: [
      "5+ years in lifecycle, CRM, or growth marketing.",
      "Experience with a modern messaging platform and SQL-friendly analytics.",
      "A record of running structured experiments.",
      "Strong writing instincts.",
    ],
    benefits: [
      "Hybrid schedule in Austin",
      "Health, dental, and vision coverage",
      "Learning budget",
      "Generous parental leave",
    ],
  },
];

const normalize = (id, d) => ({
  id,
  ...d,
  posted: d.createdAt?.toDate
    ? d.createdAt.toDate().toISOString().slice(0, 10)
    : d.posted || "",
});

/* Approved roles from Firestore; falls back to the preview roles */
export async function loadJobs() {
  if (!isConfigured) return { jobs: PREVIEW_JOBS, preview: true };
  try {
    const snap = await getDocs(
      query(collection(db, "jobs"), where("status", "==", "approved")),
    );
    const jobs = snap.docs.map((d) => normalize(d.id, d.data()));
    return jobs.length
      ? { jobs, preview: false }
      : { jobs: PREVIEW_JOBS, preview: true };
  } catch (err) {
    console.error(err);
    return { jobs: PREVIEW_JOBS, preview: true };
  }
}

/* One role. Returns null if it doesn't exist or isn't public. Throws on network errors. */
export async function loadJob(id) {
  const preview = PREVIEW_JOBS.find((j) => j.id === id);
  if (preview) return { job: preview, preview: true };
  if (!isConfigured || !id) return null;
  try {
    const snap = await getDoc(doc(db, "jobs", id));
    if (!snap.exists() || snap.data().status !== "approved") return null;
    return { job: normalize(snap.id, snap.data()), preview: false };
  } catch (err) {
    if (err.code === "permission-denied") return null;
    throw err;
  }
}
