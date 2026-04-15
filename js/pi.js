/* PI detail page */
(function () {
  "use strict";

  document.addEventListener("site:ready", async () => {
    const root = document.getElementById("pi-root");
    if (!root) return;
    try {
      const pi = await SiteUtils.loadJSON("data/pi.json");
      render(root, pi);
    } catch (err) {
      console.error(err);
      root.innerHTML = "<p>Failed to load PI profile.</p>";
    }
  });

  function render(root, pi) {
    const lang = SiteUtils.getLang();
    const i18n = SiteUtils.getI18n();
    const name = lang === "ko" ? pi.name_ko : pi.name_en;
    const title = lang === "ko" ? pi.title_ko : pi.title_en;
    const aff = lang === "ko" ? pi.affiliation_ko : pi.affiliation_en;
    const bio = lang === "ko" ? pi.bio_ko : pi.bio_en;
    const interests = lang === "ko" ? pi.interests_ko : pi.interests_en;

    const photoHTML = pi.photo
      ? `<img class="pi-photo" src="${pi.photo}" alt="${escapeHtml(name)}" onerror="this.outerHTML='<div class=pi-photo>'+'${escapeHtml(initials(name))}'+'</div>'">`
      : `<div class="pi-photo">${escapeHtml(initials(name))}</div>`;

    const linksHTML = (pi.links || []).map(l =>
      `<a href="${l.url}" target="_blank" rel="noopener" class="btn btn-outline">${escapeHtml(l.label)} →</a>`
    ).join("");

    // CV: support either {name, dataUrl} object (uploaded) or URL string, or legacy cv_link
    let cvHTML = "";
    const cv = pi.cv || pi.cv_link;
    if (cv) {
      if (typeof cv === "object" && cv.dataUrl) {
        cvHTML = `<a href="${cv.dataUrl}" download="${escapeHtml(cv.name || 'CV.pdf')}" class="btn btn-outline">📄 Download CV</a>`;
      } else if (typeof cv === "string" && cv) {
        cvHTML = `<a href="${cv}" target="_blank" rel="noopener" class="btn btn-outline">📄 Download CV</a>`;
      }
    }

    const hero = `
      <section class="pi-hero">
        ${photoHTML}
        <div>
          <h1>${escapeHtml(name)}</h1>
          <div class="subtitle">${escapeHtml(title)}</div>
          <div class="affiliation">${escapeHtml(aff)}</div>
          <p>${escapeHtml(bio)}</p>
          <div class="metrics pi-metrics">
            <div class="metric"><span class="value">${pi.metrics.citations_total.toLocaleString()}</span><span class="label">Citations</span></div>
            <div class="metric"><span class="value">${pi.metrics.h_index}</span><span class="label">h-index</span></div>
            <div class="metric"><span class="value">${pi.metrics.i10_index}</span><span class="label">i10-index</span></div>
            <div class="metric"><span class="value">${pi.metrics.as_of}</span><span class="label">As of</span></div>
          </div>
          <div class="pi-links">
            <a href="mailto:${pi.email}" class="btn btn-primary">${pi.email}</a>
            ${cvHTML}
            ${linksHTML}
          </div>
        </div>
      </section>
    `;

    const interestsBlock = interests && interests.length ? `
      <section class="pi-section">
        <h2>${lang === "ko" ? "관심 연구 분야" : "Research Interests"}</h2>
        <ul class="interests-list">${interests.map(s => `<li>${escapeHtml(s)}</li>`).join("")}</ul>
      </section>
    ` : "";

    const eduHTML = renderTimeline(
      pi.education, lang === "ko" ? "학력" : "Education",
      e => ({
        period: e.period || "",
        title: `${lang === "ko" ? e.degree_ko : e.degree_en}${e.field_ko || e.field_en ? " · " + (lang === "ko" ? e.field_ko : e.field_en) : ""}`,
        org: lang === "ko" ? e.institution_ko : e.institution_en
      })
    );

    const expHTML = renderTimeline(
      pi.experience, lang === "ko" ? "경력" : "Experience",
      e => ({
        period: lang === "ko" ? e.period_ko : e.period_en,
        title: lang === "ko" ? e.role_ko : e.role_en,
        org: lang === "ko" ? e.org_ko : e.org_en
      })
    );

    const awardsHTML = renderTimeline(
      pi.awards, lang === "ko" ? "수상" : "Awards",
      a => ({
        period: String(a.year),
        title: lang === "ko" ? a.title_ko : a.title_en,
        org: lang === "ko" ? (a.org_ko || "") : (a.org_en || "")
      })
    );

    const grantsHTML = renderTimeline(
      pi.grants, lang === "ko" ? "수행 연구 과제" : "Research Grants & Projects",
      g => ({
        period: lang === "ko" ? g.period_ko : g.period_en,
        title: `${lang === "ko" ? g.title_ko : g.title_en}${g.role_ko || g.role_en ? ' · ' + (lang === "ko" ? g.role_ko : g.role_en) : ''}`,
        org: lang === "ko" ? (g.agency_ko || "") : (g.agency_en || "")
      })
    );

    root.innerHTML = hero + interestsBlock + eduHTML + expHTML + grantsHTML + awardsHTML;
  }

  function renderTimeline(items, title, map) {
    if (!items || items.length === 0) return "";
    const lis = items.map(item => {
      const m = map(item);
      return `
        <li>
          <div class="period">${escapeHtml(m.period || "")}</div>
          <div>
            <div class="title-text">${escapeHtml(m.title || "")}</div>
            ${m.org ? `<div class="org">${escapeHtml(m.org)}</div>` : ""}
          </div>
        </li>`;
    }).join("");
    return `
      <section class="pi-section">
        <h2>${escapeHtml(title)}</h2>
        <ul class="pi-timeline">${lis}</ul>
      </section>
    `;
  }

  function initials(name) {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    return (parts[0][0] + (parts[1] ? parts[1][0] : "")).toUpperCase();
  }

  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[c]);
  }
})();
