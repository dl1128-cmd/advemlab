/* Board page · news list with tabs */
(function () {
  "use strict";

  const TABS = [
    { id: "all", key: "all" },
    { id: "news", key: "news" },
    { id: "notice", key: "notice" },
    { id: "seminar", key: "seminar" }
  ];

  let items = [];
  let current = "all";

  document.addEventListener("site:ready", async () => {
    const root = document.getElementById("board-root");
    if (!root) return;
    try {
      items = await SiteUtils.loadJSON("data/news.json");
      items.sort((a, b) => (a.date < b.date ? 1 : -1));
      renderTabs(root);
      renderList(root);
    } catch (err) {
      console.error(err);
      root.innerHTML = "<p>Failed to load board.</p>";
    }
  });

  function renderTabs(root) {
    const i18n = SiteUtils.getI18n();
    const wrap = document.createElement("div");
    wrap.className = "board-tabs";
    TABS.forEach(t => {
      const btn = document.createElement("button");
      btn.className = "board-tab" + (t.id === current ? " active" : "");
      btn.textContent = t.id === "all" ? (SiteUtils.getLang() === "ko" ? "전체" : "All") : i18n.board[t.key];
      btn.addEventListener("click", () => {
        current = t.id;
        wrap.querySelectorAll(".board-tab").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        renderList(root);
      });
      wrap.appendChild(btn);
    });
    root.appendChild(wrap);
    const host = document.createElement("div");
    host.id = "board-list-host";
    root.appendChild(host);
  }

  function renderList(root) {
    const host = root.querySelector("#board-list-host");
    host.innerHTML = "";
    const lang = SiteUtils.getLang();
    const filtered = current === "all" ? items : items.filter(x => x.category === current);
    if (filtered.length === 0) {
      host.innerHTML = `<p style="text-align:center;color:var(--color-text-light)">No items.</p>`;
      return;
    }
    const ul = document.createElement("ul");
    ul.className = "news-list";
    filtered.forEach(n => {
      const li = document.createElement("li");
      li.className = "news-item";
      li.innerHTML = `
        <div class="date">${n.date}</div>
        <div class="body">
          <div class="title">${escapeHtml(lang === "ko" ? n.title_ko : n.title_en)}</div>
          <div class="excerpt">${escapeHtml(lang === "ko" ? n.body_ko : n.body_en)}</div>
        </div>
      `;
      ul.appendChild(li);
    });
    host.appendChild(ul);
  }

  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[c]);
  }
})();
