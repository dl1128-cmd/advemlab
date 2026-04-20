/* AdvEM Lab — common site scripts
   i18n toggle · nav · data loading helpers
*/
(function () {
  "use strict";

  const LS_KEY = "advemlab:lang";

  const state = {
    lang: detectLang(),
    i18n: null,
    config: null
  };

  function detectLang() {
    const fromUrl = new URLSearchParams(location.search).get("lang");
    if (fromUrl === "ko" || fromUrl === "en") return fromUrl;
    const saved = localStorage.getItem(LS_KEY);
    if (saved === "ko" || saved === "en") return saved;
    return (navigator.language || "ko").startsWith("ko") ? "ko" : "en";
  }

  async function loadJSON(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Failed: ${path}`);
    return res.json();
  }

  async function init() {
    document.documentElement.lang = state.lang;
    try {
      const [i18n, config] = await Promise.all([
        loadJSON(`locales/${state.lang}.json`),
        loadJSON("data/config.json")
      ]);
      state.i18n = i18n;
      state.config = config;
      window.__SITE__ = state;
      applyI18n();
      applyConfig();
      setupNav();
      setupLangToggle();
      document.dispatchEvent(new CustomEvent("site:ready", { detail: state }));
      setupHashScroll();
      // Non-blocking: load Scholar citation metrics
      autoUpdateScholarMetrics().catch(() => {});
    } catch (err) {
      console.error("Site init failed:", err);
    }
  }

  function getKey(obj, path) {
    return path.split(".").reduce((o, k) => (o && o[k] !== undefined ? o[k] : null), obj);
  }

  function applyI18n() {
    document.querySelectorAll("[data-i18n]").forEach(el => {
      const key = el.getAttribute("data-i18n");
      const v = getKey(state.i18n, key);
      if (v !== null) el.textContent = v;
    });
    document.querySelectorAll("[data-i18n-attr]").forEach(el => {
      const spec = el.getAttribute("data-i18n-attr");
      const [attr, key] = spec.split(":");
      const v = getKey(state.i18n, key);
      if (v !== null) el.setAttribute(attr, v);
    });
  }

  function applyConfig() {
    const { config, lang } = state;
    const name = lang === "ko" ? config.lab.name_ko : config.lab.name_en;
    const slogan = lang === "ko" ? config.lab.slogan_ko : config.lab.slogan_en;
    const aff = lang === "ko" ? config.lab.affiliation_ko : config.lab.affiliation_en;

    document.querySelectorAll("[data-lab-name]").forEach(el => el.textContent = name);
    document.querySelectorAll("[data-lab-short]").forEach(el => el.textContent = config.lab.short);
    document.querySelectorAll("[data-lab-slogan]").forEach(el => el.textContent = slogan);
    document.querySelectorAll("[data-lab-affiliation]").forEach(el => el.textContent = aff);
    document.querySelectorAll("[data-contact-email]").forEach(el => {
      el.textContent = config.contact.email;
      if (el.tagName === "A") el.href = "mailto:" + config.contact.email;
    });
    document.querySelectorAll("[data-contact-address]").forEach(el => {
      el.textContent = lang === "ko" ? config.contact.address_ko : config.contact.address_en;
    });
    document.querySelectorAll("[data-contact-address-detail]").forEach(el => {
      el.textContent = lang === "ko" ? config.contact.address_detail_ko : config.contact.address_detail_en;
    });
    document.querySelectorAll("[data-maps-embed]").forEach(el => {
      if (config.contact.maps_embed) el.src = config.contact.maps_embed;
    });

    // Hero background image from uploaded lab photo
    if (config.lab && config.lab.hero_image) {
      const hero = document.querySelector(".hero");
      if (hero) {
        hero.style.setProperty("--hero-bg-image", `url(${config.lab.hero_image})`);
        hero.classList.add("has-bg-image");
      }
    }

    document.querySelectorAll("[data-metric]").forEach(el => {
      const k = el.getAttribute("data-metric");
      const v = state.config.metrics[k];
      if (v !== undefined) el.textContent = typeof v === "number" ? v.toLocaleString() : v;
    });

    const titleBase = config.lab.short;
    if (!document.title.includes(titleBase)) {
      document.title = document.title ? `${document.title} · ${titleBase}` : titleBase;
    }
  }

  function setupNav() {
    const toggle = document.querySelector(".nav-toggle");
    const links = document.querySelector(".nav-links");
    if (toggle && links) {
      toggle.addEventListener("click", () => links.classList.toggle("open"));
    }
    const path = location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll(".nav-links a").forEach(a => {
      const href = a.getAttribute("href");
      if (href === path || (path === "" && href === "index.html")) a.classList.add("active");
    });
  }

  function setupHashScroll() {
    if (!location.hash) return;
    const hash = location.hash;
    let tries = 0;
    const tryScroll = () => {
      const el = document.querySelector(hash);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        el.style.transition = "outline 500ms ease";
        el.style.outline = "2px solid var(--color-primary-light)";
        setTimeout(() => (el.style.outline = ""), 1500);
      } else if (tries++ < 20) {
        setTimeout(tryScroll, 100);
      }
    };
    setTimeout(tryScroll, 200);
  }

  function setupLangToggle() {
    document.querySelectorAll(".lang-toggle").forEach(btn => {
      btn.addEventListener("click", () => {
        const next = state.lang === "ko" ? "en" : "ko";
        localStorage.setItem(LS_KEY, next);
        const url = new URL(location.href);
        url.searchParams.set("lang", next);
        location.href = url.toString();
      });
    });
  }

  /* =========================================================================
   * Scholar metrics loader
   * Primary: loads data/scholar_metrics.json (committed by GitHub Actions daily)
   * Fallback: fetches from OpenAlex API if scholar_metrics.json is missing
   * ========================================================================= */
  const OPENALEX_CACHE_KEY = "advem:openalex:cache:v1";
  const OPENALEX_CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

  async function loadScholarMetrics() {
    try {
      const res = await fetch("data/scholar_metrics.json?t=" + Date.now(), { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        // Normalize history field: Actions script uses "count", chart expects "n"
        if (data.citations_history) {
          data.citations_history = data.citations_history.map(h => ({
            year: h.year,
            n: h.count !== undefined ? h.count : h.n
          }));
        }
        applyScholarMetrics(data);
        return;
      }
    } catch { /* file may not exist yet */ }
    // Fallback to OpenAlex if scholar_metrics.json is not available
    await loadOpenAlexFallback();
  }

  async function loadOpenAlexFallback() {
    const config = state.config;
    if (!config?.pi?.name_en) return;
    try {
      const cached = JSON.parse(localStorage.getItem(OPENALEX_CACHE_KEY) || "null");
      if (cached && (Date.now() - cached.t) < OPENALEX_CACHE_TTL) {
        applyScholarMetrics(cached.data);
        return;
      }
    } catch {}
    try {
      const name = config.pi.name_en;
      const url = `https://api.openalex.org/works?per-page=200&filter=raw_author_name.search:${encodeURIComponent(name)}&mailto=scholar-bot@users.noreply.github.com`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      const papers = (data.results || []).map(w => ({
        title: w.title || w.display_name || "",
        citations: w.cited_by_count || 0,
        year: w.publication_year || 0,
        scholar_link: ""
      }));
      const metrics = { papers: papers, _source: "openalex" };
      localStorage.setItem(OPENALEX_CACHE_KEY, JSON.stringify({ t: Date.now(), data: metrics }));
      applyScholarMetrics(metrics);
    } catch { /* OpenAlex unavailable — silent */ }
  }

  async function autoUpdateScholarMetrics() {
    await loadScholarMetrics();
  }

  function applyScholarMetrics(metrics) {
    if (!metrics) return;
    // Update numeric metrics on page
    if (state.config.metrics) {
      const metricKeys = ["citations_total", "citations_recent5y", "h_index", "i10_index"];
      metricKeys.forEach(k => {
        if (metrics[k] !== undefined) state.config.metrics[k] = metrics[k];
      });
    }
    document.querySelectorAll("[data-metric]").forEach(el => {
      const k = el.getAttribute("data-metric");
      const v = metrics[k];
      if (v !== undefined) el.textContent = typeof v === "number" ? v.toLocaleString() : v;
    });
    if (metrics.citations_history && metrics.citations_history.length) {
      document.dispatchEvent(new CustomEvent("scholar:history", { detail: metrics.citations_history }));
    }
    if (metrics.papers && metrics.papers.length) {
      document.dispatchEvent(new CustomEvent("scholar:papers", { detail: metrics.papers }));
    }
    state.config.scholar_metrics = metrics;
    document.dispatchEvent(new CustomEvent("scholar:totals", { detail: metrics }));
  }

  window.SiteUtils = {
    loadJSON,
    getLang: () => state.lang,
    getI18n: () => state.i18n,
    getConfig: () => state.config
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
