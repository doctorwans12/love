let questions = [];
let resultsData = {};
let previewPoints = {};
let scoreKeys = [];
let currentLang = "ro";

// ====== LOCALES ======
// Păstrează obiectul tău locales EXACT cum îl ai (ro/en/fr/es/it/de).
// Eu aici presupun că "const locales = {...}" există deja în script (cum ai trimis).
// Dacă îl ai deja, NU schimba nimic la el.
// (În codul tău postat, locales există deja - perfect.)

// ====== QUIZ CORE ======
const buildScores = () =>
  scoreKeys.reduce((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {});

let current = 0;
let scores = {};

function bestChoice() {
  return scoreKeys.reduce(
    (best, key) => (scores[key] > scores[best] ? key : best),
    scoreKeys[0]
  );
}

function setLanguage(lang) {
  const locale = locales[lang] || locales.ro;
  currentLang = lang in locales ? lang : "ro";
  document.documentElement.lang = currentLang;
  document.title = locale.pageTitle;

  document.getElementById("language-title").innerText = locale.languageTitle;
  document.getElementById("language-subtitle").innerText = locale.languageSubtitle;
  document.getElementById("intro-text").innerText = locale.introText;
  document.getElementById("intro-cta").innerText = locale.introCta;

  document.getElementById("preview-heading").innerText = locale.previewHeading;
  document.getElementById("preview-lock").innerText = locale.previewLocked;
  document.getElementById("preview-cta-primary").innerText = locale.previewCtaPrimary;
  document.getElementById("preview-cta-basic").innerText = locale.previewCtaBasic;
  document.getElementById("preview-trust").innerText = locale.previewTrust;

  document.getElementById("manifesto-text").innerText = locale.manifesto;

  document.getElementById("success-title").innerText = locale.successTitle;
  document.getElementById("success-congrats").innerText = locale.successCongrats;
  document.getElementById("success-wish").innerText = locale.successWish;
  document.getElementById("success-restart").innerText = locale.successRestart;

  document.getElementById("footer-title").innerText = locale.footerTitle;
  document.getElementById("footer-cta-primary").innerText = locale.footerCtaPrimary;
  document.getElementById("footer-cta-basic").innerText = locale.footerCtaBasic;
  document.getElementById("footer-trust").innerText = locale.footerTrust;

  questions = locale.questions;
  resultsData = locale.resultsData;
  previewPoints = locale.previewPoints;
  scoreKeys = locale.scoreKeys;
  scores = buildScores();
}

function selectLanguage(lang) {
  localStorage.setItem("lang", lang);
  setLanguage(lang);
  navigate("intro");
}

function navigate(id) {
  document.querySelectorAll(".section").forEach((s) => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");

  // footer bar doar la preview
  const footer = document.getElementById("footerBar");
  if (footer) footer.style.display = id === "result-preview" ? "block" : "none";

  if (id === "quiz") {
    current = 0;
    scores = buildScores();
    loadQ();
  }

  if (id === "result-preview") window.scrollTo(0, 0);
}

function loadQ() {
  if (current >= questions.length) {
    const choice = bestChoice();
    localStorage.setItem("lastPlanChoice", choice);
    showPreview(choice);
    return;
  }

  document.getElementById("q-title").innerText = questions[current].q;

  const container = document.getElementById("q-options");
  container.innerHTML = "";

  questions[current].a.forEach((opt) => {
    const b = document.createElement("button");
    b.className = "btn btn-opt";
    b.innerText = opt.t || opt;

    b.onclick = () => {
      if (Object.prototype.hasOwnProperty.call(scores, opt.c)) {
        scores[opt.c]++;
      }
      current++;
      loadQ();
    };

    container.appendChild(b);
  });
}

function showPreview(choice) {
  navigate("result-preview");

  const previewTitle = document.getElementById("preview-title");
  const previewList = document.getElementById("preview-points");
  const previewContent = document.getElementById("preview-content");
  const previewLock = document.getElementById("preview-lock");

  previewTitle.innerText = resultsData[choice]?.name || "";
  previewList.innerHTML = "";

  (previewPoints[choice] || []).forEach((point) => {
    const li = document.createElement("li");
    li.innerText = point;
    previewList.appendChild(li);
  });

  previewContent.classList.add("blurred");
  previewLock.style.display = "flex";
}

function showBasicOnly() {
  const previewContent = document.getElementById("preview-content");
  const previewLock = document.getElementById("preview-lock");
  const previewCta = document.getElementById("preview-cta");
  const footer = document.getElementById("footerBar");

  previewContent.classList.remove("blurred");
  previewLock.style.display = "none";
  if (previewCta) previewCta.style.display = "none";
  if (footer) footer.style.display = "none";
}

// ====== STRIPE (PAY + RETURN) ======
function pay() {
  const choice = bestChoice(); // A/B/C/D
  localStorage.setItem("lastPlanChoice", choice);
  window.location.href = `/pay-session?choice=${encodeURIComponent(choice)}`;
}

async function handleStripeReturnIfAny() {
  const params = new URLSearchParams(window.location.search);

  // cancel flow: /?canceled=1
  if (params.has("canceled")) {
    // revii la preview (dacă exista)
    const saved = localStorage.getItem("lastPlanChoice");
    if (saved && resultsData[saved]) showPreview(saved);
    return true; // am tratat
  }

  // success flow: /?session_id=cs_...
  const sessionId = params.get("session_id");
  if (!sessionId) return false; // nu e din Stripe

  try {
    const res = await fetch(
      `/verify-session?session_id=${encodeURIComponent(sessionId)}`,
      { headers: { Accept: "application/json" } }
    );

    const data = await res.json();

    // curățăm URL-ul (să nu tot rămână session_id)
    window.history.replaceState({}, document.title, window.location.pathname);

    if (!data || data.paid !== true) {
      // nu e plătit => arată preview
      const saved = localStorage.getItem("lastPlanChoice");
      if (saved && resultsData[saved]) showPreview(saved);
      return true;
    }

    // e plătit => plan din metadata
    const plan =
      data.plan && resultsData[data.plan]
        ? data.plan
        : localStorage.getItem("lastPlanChoice");

    navigate("success-view");

    const footer = document.getElementById("footerBar");
    if (footer) footer.style.display = "none";

    if (plan && resultsData[plan]) {
      document.getElementById("final-type").innerText = resultsData[plan].name;
      document.getElementById("final-desc").innerText = resultsData[plan].desc;
    }

    return true;
  } catch (e) {
    console.error("verify-session failed:", e);
    const saved = localStorage.getItem("lastPlanChoice");
    if (saved && resultsData[saved]) showPreview(saved);
    return true;
  }
}

// ====== BOOT ======
window.onload = async () => {
  const storedLang = localStorage.getItem("lang") || "ro";
  setLanguage(storedLang);

  // Dacă vine din Stripe (success/canceled), tratăm și gata
  const handled = await handleStripeReturnIfAny();
  if (handled) return;

  // start normal
  navigate("language");
};
