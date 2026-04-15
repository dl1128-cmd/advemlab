/* Research page rendering — topics + overview */
(function () {
  "use strict";

  document.addEventListener("site:ready", async () => {
    const root = document.getElementById("research-root");
    if (!root) return;
    try {
      const topics = await SiteUtils.loadJSON("data/research_topics.json");
      render(root, topics);
    } catch (err) {
      console.error(err);
      root.innerHTML = "<p>Failed to load research topics.</p>";
    }
  });

  function render(root, topics) {
    const lang = SiteUtils.getLang();
    root.innerHTML = "";
    const grid = document.createElement("div");
    grid.className = "grid grid-2";
    topics.sort((a, b) => a.order - b.order).forEach(t => {
      const name = lang === "ko" ? t.title_ko : t.title_en;
      const desc = lang === "ko" ? t.summary_ko : t.summary_en;
      const card = document.createElement("article");
      card.className = "topic-card";
      card.id = t.id;
      const keywordsHTML = (t.keywords || []).map(k => `<span class="tag">${escapeHtml(k)}</span>`).join("");
      const papersHTML = (t.representative_papers || []).map(p => `<li>${escapeHtml(p)}</li>`).join("");
      const figureHTML = t.svg ? `<div class="topic-figure">${t.svg}</div>` : "";
      card.innerHTML = `
        ${figureHTML}
        <h3>${escapeHtml(name)}</h3>
        <p>${escapeHtml(desc)}</p>
        <div class="tags">${keywordsHTML}</div>
        ${papersHTML ? `
          <div class="rep-papers">
            <h4>${lang === "ko" ? "대표 논문" : "Representative Papers"}</h4>
            <ul>${papersHTML}</ul>
          </div>
        ` : ""}
      `;
      grid.appendChild(card);
    });
    root.appendChild(grid);
  }

  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[c]);
  }
})();
