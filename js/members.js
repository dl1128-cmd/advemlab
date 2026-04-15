/* Members page rendering — grouped by role */
(function () {
  "use strict";

  const ORDER = ["professor", "postdoc", "phd", "ms", "undergraduate", "alumni"];

  document.addEventListener("site:ready", async () => {
    const root = document.getElementById("members-root");
    if (!root) return;
    try {
      const members = await SiteUtils.loadJSON("data/members.json");
      render(root, members);
    } catch (err) {
      console.error(err);
      root.innerHTML = "<p>Failed to load members.</p>";
    }
  });

  function render(root, members) {
    const lang = SiteUtils.getLang();
    const i18n = SiteUtils.getI18n();
    const grouped = {};
    members.forEach(m => { (grouped[m.role] ||= []).push(m); });

    ORDER.forEach(role => {
      if (!grouped[role] || grouped[role].length === 0) return;
      const group = document.createElement("section");
      group.className = "member-group";
      const title = i18n.member[role] || role;
      group.innerHTML = `<h3>${title}</h3>`;
      const grid = document.createElement("div");
      grid.className = "grid grid-3";
      grouped[role].forEach(m => grid.appendChild(renderCard(m, lang, role)));
      group.appendChild(grid);
      root.appendChild(group);
    });
  }

  function renderCard(m, lang, role) {
    const name = lang === "ko" ? m.name_ko : m.name_en;
    const title = lang === "ko" ? m.title_ko : m.title_en;
    const interests = lang === "ko" ? m.interests_ko : m.interests_en;
    const isPI = role === "professor";
    const tag = isPI ? "a" : "div";
    const card = document.createElement(tag);
    card.className = "card member-card";
    if (isPI) {
      card.href = "pi.html";
      card.style.textDecoration = "none";
      card.style.color = "inherit";
    }
    const photoHTML = m.photo
      ? `<img class="photo" src="${m.photo}" alt="${escapeHtml(name)}" onerror="this.outerHTML='<div class=photo>'+'${escapeHtml(initials(name))}'+'</div>'">`
      : `<div class="photo">${escapeHtml(initials(name))}</div>`;
    card.innerHTML = `
      ${photoHTML}
      <div class="name">${escapeHtml(name)}</div>
      <div class="role">${escapeHtml(title)}</div>
      <div class="interests">${escapeHtml(interests || "")}</div>
      ${m.email ? `<div style="margin-top:.75rem;font-size:.85rem"><a href="mailto:${m.email}" ${isPI ? 'onclick="event.stopPropagation()"' : ''}>${m.email}</a></div>` : ""}
      ${isPI ? `<div style="margin-top:.5rem;font-size:.8rem;color:var(--color-primary);font-weight:600">${lang === "ko" ? "상세 프로필 →" : "View profile →"}</div>` : ""}
    `;
    return card;
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
