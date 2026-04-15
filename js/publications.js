/* Publications page rendering + filters */
(function () {
  "use strict";

  const FILTERS = [
    { id: "top", label_ko: "대표 논문", label_en: "Top Picks", test: p => p.top_pick === true },
    { id: "journal", label_ko: "저널", label_en: "Journal", test: p => p.type === "journal" },
    { id: "conference", label_ko: "학회", label_en: "Conference", test: p => p.type === "conference" },
    { id: "book", label_ko: "저서·특허", label_en: "Book · Patent", test: p => p.type === "book" || p.type === "patent" },
    { id: "all", label_ko: "전체", label_en: "All", test: () => true }
  ];

  let publications = [];
  let current = "top";

  document.addEventListener("site:ready", async () => {
    const root = document.getElementById("publications-root");
    if (!root) return;
    try {
      publications = await SiteUtils.loadJSON("data/publications.json");
      renderFilters(root);
      render(root);
    } catch (err) {
      root.innerHTML = `<p>Failed to load publications.</p>`;
      console.error(err);
    }
  });

  function renderFilters(root) {
    const lang = SiteUtils.getLang();
    const wrap = document.createElement("div");
    wrap.className = "pub-filters";
    FILTERS.forEach(f => {
      const btn = document.createElement("button");
      btn.className = "pub-filter" + (f.id === current ? " active" : "");
      const count = publications.filter(f.test).length;
      const label = lang === "ko" ? f.label_ko : f.label_en;
      btn.innerHTML = `${label} <span class="pub-filter-count">${count}</span>`;
      btn.addEventListener("click", () => {
        current = f.id;
        wrap.querySelectorAll(".pub-filter").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        render(root, true);
      });
      wrap.appendChild(btn);
    });
    root.appendChild(wrap);
    const listHost = document.createElement("div");
    listHost.id = "pub-list-host";
    root.appendChild(listHost);
  }

  function render(root, replace) {
    const host = root.querySelector("#pub-list-host");
    host.innerHTML = "";
    const f = FILTERS.find(x => x.id === current);
    const filtered = publications.filter(f.test);
    if (filtered.length === 0) {
      host.innerHTML = `<p style="text-align:center;color:var(--color-text-light)">No publications in this category.</p>`;
      return;
    }
    const byYear = groupByYear(filtered);
    const years = Object.keys(byYear).sort((a, b) => b - a);
    years.forEach(year => {
      const group = document.createElement("section");
      group.className = "pub-year-group";
      group.innerHTML = `<h3>${year}</h3>`;
      const ul = document.createElement("ul");
      ul.className = "pub-list";
      byYear[year].forEach((p, i) => ul.appendChild(renderItem(p, i + 1)));
      group.appendChild(ul);
      host.appendChild(group);
    });
  }

  function groupByYear(items) {
    return items.reduce((acc, p) => {
      (acc[p.year] ||= []).push(p);
      return acc;
    }, {});
  }

  function renderItem(p, n) {
    const li = document.createElement("li");
    li.className = "pub-item";
    const topBadge = p.top_pick ? `<span class="badge-top">Top Pick</span>` : "";
    // link can be: URL string, or {name, dataUrl} object (uploaded PDF), or empty
    let linkHref = "";
    let linkAttrs = 'target="_blank" rel="noopener"';
    if (p.link) {
      if (typeof p.link === "object" && p.link.dataUrl) {
        linkHref = p.link.dataUrl;
        linkAttrs = `download="${escapeHtml(p.link.name || 'paper.pdf')}"`;
      } else if (typeof p.link === "string") {
        linkHref = p.link;
      }
    }
    const linkHTML = linkHref
      ? `<a href="${linkHref}" ${linkAttrs}>${escapeHtml(p.title)}</a>`
      : escapeHtml(p.title);
    li.innerHTML = `
      <div class="pub-num">${String(n).padStart(2, "0")}</div>
      <div class="pub-body">
        <div class="title">${linkHTML}${topBadge}</div>
        <div class="meta">
          ${escapeHtml(p.authors)} · <span class="venue">${escapeHtml(p.venue)}</span>${p.volume ? ", " + escapeHtml(p.volume) : ""} (${p.year})
        </div>
      </div>
      <div class="cite-count" title="Citations">
        <span class="n">${p.citations ?? 0}</span>
        <span class="lbl">Cites</span>
      </div>
    `;
    return li;
  }

  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[c]);
  }
})();
