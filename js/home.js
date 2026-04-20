/* Home page — research topics + recent highlights rendering */
(function () {
  "use strict";

  document.addEventListener("site:ready", async () => {
    try {
      const [topics, pubs, news] = await Promise.all([
        SiteUtils.loadJSON("data/research_topics.json"),
        SiteUtils.loadJSON("data/publications.json"),
        SiteUtils.loadJSON("data/news.json")
      ]);
      renderTopics(topics);
      renderHighlights(pubs, news);
      const pubMetric = document.getElementById("metric-pubs");
      if (pubMetric) {
        const journalCount = pubs.filter(p => (p.type || "journal") === "journal").length;
        pubMetric.textContent = journalCount + "+";
      }
    } catch (err) {
      console.error(err);
    }
  });

  function renderTopics(topics) {
    const host = document.getElementById("home-topics");
    if (!host) return;
    const lang = SiteUtils.getLang();
    host.innerHTML = "";
    topics.sort((a, b) => a.order - b.order).forEach(t => {
      const name = lang === "ko" ? t.title_ko : t.title_en;
      const desc = lang === "ko" ? t.summary_ko : t.summary_en;
      const card = document.createElement("a");
      card.href = `research.html#${t.id}`;
      card.className = "card";
      card.style.textDecoration = "none";
      card.innerHTML = `
        <h3>${escapeHtml(name)}</h3>
        <p>${escapeHtml(desc)}</p>
        <div class="tags">${(t.keywords || []).map(k => `<span class="tag">${escapeHtml(k)}</span>`).join("")}</div>
      `;
      host.appendChild(card);
    });
  }

  function renderHighlights(pubs, news) {
    const newsHost = document.getElementById("home-news");
    if (newsHost) {
      const lang = SiteUtils.getLang();
      const sorted = [...news].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 3);
      newsHost.innerHTML = "";
      sorted.forEach(n => {
        const item = document.createElement("a");
        item.href = "board.html";
        item.className = "card";
        item.style.textDecoration = "none";
        item.innerHTML = `
          <div style="font-size:.75rem;color:var(--color-text-light);font-family:var(--font-mono);margin-bottom:.5rem">${n.date}</div>
          <h3 style="font-size:1rem">${escapeHtml(lang === "ko" ? n.title_ko : n.title_en)}</h3>
        `;
        newsHost.appendChild(item);
      });
    }

    const pubHost = document.getElementById("home-publications");
    if (pubHost) {
      const top = pubs.filter(p => p.top_pick).slice(0, 3);
      pubHost.innerHTML = "";
      top.forEach(p => {
        const card = document.createElement("a");
        card.href = "publications.html";
        card.className = "card";
        card.style.textDecoration = "none";
        card.innerHTML = `
          <div style="font-size:.75rem;color:var(--color-primary);font-weight:600;letter-spacing:.05em;margin-bottom:.5rem">${p.year} · ${escapeHtml(p.venue)}</div>
          <h3 style="font-size:1rem;line-height:1.4">${escapeHtml(p.title)}</h3>
          <div style="font-size:.8rem;color:var(--color-text-muted);margin-top:.5rem">${escapeHtml(p.authors)}</div>
        `;
        pubHost.appendChild(card);
      });
    }
  }

  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[c]);
  }
})();
