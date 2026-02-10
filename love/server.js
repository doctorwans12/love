// =========================
// STRIPE: PAY + RETURN FLOW
// =========================

// 1) Apeși "Deblochează" -> te duce la Stripe checkout
function pay() {
  // ia rezultatul calculat (A/B/C/D)
  const choice = bestChoice();

  // îl salvăm ca fallback (dacă ceva nu vine din Stripe)
  localStorage.setItem("lastPlanChoice", choice);

  // redirect către backend (care creează Stripe Checkout Session)
  window.location.href = `/pay-session?choice=${encodeURIComponent(choice)}`;
}


// 2) După ce Stripe te întoarce pe site: /?session_id=...
async function handleStripeReturn() {
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get("session_id");
  if (!sessionId) return; // nu e return din Stripe

  try {
    // verificăm dacă e plătit + luăm planul din metadata
    const res = await fetch(`/verify-session?session_id=${encodeURIComponent(sessionId)}`, {
      headers: { "Accept": "application/json" }
    });
    const data = await res.json();

    // Curățăm URL-ul (să nu rămână session_id în bară)
    window.history.replaceState({}, document.title, window.location.pathname);

    // dacă nu e paid, îl trimitem înapoi la preview
    if (!data || data.paid !== true) {
      const saved = localStorage.getItem("lastPlanChoice");
      if (saved) showPreview(saved);
      return;
    }

    // e paid -> plan vine din Stripe metadata: A/B/C/D
    const planFromStripe = data.plan;
    const plan = (planFromStripe && resultsData && resultsData[planFromStripe])
      ? planFromStripe
      : localStorage.getItem("lastPlanChoice");

    // mergem la ecranul de success/reultat complet
    navigate("success-view");

    // ascundem bara de jos dacă există
    const footer = document.getElementById("footerBar");
    if (footer) footer.style.display = "none";

    // setăm rezultatul final
    if (plan && resultsData && resultsData[plan]) {
      document.getElementById("final-type").innerText = resultsData[plan].name;
      document.getElementById("final-desc").innerText = resultsData[plan].desc;
    }
  } catch (e) {
    console.error("Stripe verify failed:", e);
    // fallback: îl întorci la preview
    const saved = localStorage.getItem("lastPlanChoice");
    if (saved) showPreview(saved);
  }
}


// 3) Rulează automat la încărcarea paginii (după ce setLanguage() a populat resultsData)
const _oldOnload = window.onload;
window.onload = async () => {
  // dacă tu ai deja window.onload în cod, îl păstrăm
  if (typeof _oldOnload === "function") _oldOnload();

  // apoi verificăm returnul din Stripe
  await handleStripeReturn();
};
