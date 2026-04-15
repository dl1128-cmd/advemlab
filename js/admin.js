/* AdvEM Lab — Admin panel
 *
 * Pure client-side editor for publications / members / news / research topics / config.
 * Saves = generates updated JSON and triggers browser download.
 *
 * SECURITY NOTE
 * -------------
 * This is a "soft gate" — prevents accidental edits by students, NOT real authentication.
 * The password hash is embedded in JS source and visible to anyone who views source.
 * True admin security requires a backend (Firebase, Supabase, Netlify Identity, etc.).
 * For a lab website where the only way to modify the live site is to replace files on the
 * server, this soft gate is the correct level of security.
 */
(function () {
  "use strict";

  const STATE = {
    authed: false,
    data: {
      publications: null,
      members: null,
      news: null,
      topics: null,
      config: null,
      pi: null
    },
    currentTab: "publications",
    modal: { onSave: null }
  };

  const LS_PW_HASH = "advemlab:admin:pwhash";
  // SHA-256 of "advemlab2026" — the default password
  const DEFAULT_PW_HASH = "90c1e664994e74ac5321e4991147404a7b283f29b9af3fb87c1f6ed470fcf0e0";

  /* =========================================================================
   * Image picker + client-side resize
   * base64 로 JSON 에 저장 → 별도 파일 업로드 불필요
   * ========================================================================= */
  function resizeImageFile(file, maxW, maxH, quality) {
    return new Promise((resolve, reject) => {
      if (!file) return reject(new Error("no file"));
      if (!file.type.startsWith("image/")) return reject(new Error("이미지 파일만 가능"));
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let w = img.width, h = img.height;
          if (w > maxW || h > maxH) {
            const r = Math.min(maxW / w, maxH / h);
            w = Math.round(w * r);
            h = Math.round(h * r);
          }
          const canvas = document.createElement("canvas");
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext("2d");
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL("image/jpeg", quality || 0.85));
        };
        img.onerror = () => reject(new Error("이미지 읽기 실패"));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error("파일 읽기 실패"));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Mount an image picker into a container element.
   * @param {HTMLElement} host
   * @param {string} currentSrc — existing image url or data url
   * @param {{maxW:number, maxH:number}} opts
   * @param {(dataUrl:string)=>void} onChange
   */
  function mountImagePicker(host, currentSrc, opts, onChange) {
    const safeSrc = currentSrc || "";
    const isDataUrl = safeSrc.startsWith("data:");
    const hasRealImage = safeSrc && (isDataUrl || /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(safeSrc));
    host.innerHTML = `
      <div class="admin-img-picker">
        <div class="admin-img-preview">
          ${hasRealImage
            ? `<img src="${escapeAttr(safeSrc)}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div class="admin-img-placeholder" style="display:none">이미지 없음</div>`
            : `<div class="admin-img-placeholder">사진을<br/>선택하세요</div>`}
        </div>
        <div class="admin-img-controls">
          <label class="btn btn-primary btn-sm" style="cursor:pointer">
            📁 사진 파일 선택
            <input type="file" accept="image/jpeg,image/png,image/webp" style="display:none" />
          </label>
          <button type="button" class="btn btn-ghost btn-sm" data-action="clear">✕ 사진 제거</button>
          <div class="admin-img-hint">
            ✅ JPG · PNG · WebP 지원<br/>
            ✅ 자동 ${opts.maxW}×${opts.maxH} 리사이즈 → JSON 안에 인라인 저장<br/>
            ✅ <b>FTP 업로드 불필요</b> — JSON 저장하면 사진까지 같이 포함됨
          </div>
        </div>
      </div>
    `;
    let value = safeSrc;
    const input = host.querySelector('input[type=file]');
    const preview = host.querySelector('.admin-img-preview');
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const dataUrl = await resizeImageFile(file, opts.maxW, opts.maxH, 0.85);
        value = dataUrl;
        preview.innerHTML = `<img src="${dataUrl}" alt="" /><div style="position:absolute;bottom:4px;right:4px;background:rgba(0,0,0,0.6);color:#fff;padding:2px 6px;border-radius:3px;font-size:10px">${Math.round(dataUrl.length / 1024)}KB</div>`;
        onChange(value);
      } catch (err) {
        toast(err.message || "이미지 처리 실패", "error");
      }
      input.value = ""; // allow re-pick of same file
    };
    host.querySelector('[data-action=clear]').onclick = () => {
      value = "";
      preview.innerHTML = `<div class="admin-img-placeholder">이미지 없음</div>`;
      onChange("");
    };
    return { getValue: () => value };
  }

  /* =========================================================================
   * Generic file picker (PDF / 문서 등 이미지 외 파일)
   * - 파일 업로드 → base64 data URL 로 변환 → JSON 에 인라인 저장
   * - 또는 외부 URL 직접 입력 허용 (대용량 PDF 용)
   * ========================================================================= */
  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve({ dataUrl: e.target.result, name: file.name, size: file.size, type: file.type });
      reader.onerror = () => reject(new Error("파일 읽기 실패"));
      reader.readAsDataURL(file);
    });
  }

  function formatBytes(n) {
    if (!n) return "0 B";
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
    return (n / 1024 / 1024).toFixed(2) + " MB";
  }

  /**
   * Mount a file picker that stores either:
   *   - { kind: 'file', dataUrl, name, size } — uploaded file, base64 inline
   *   - { kind: 'url', url } — external link
   *   - null — empty
   *
   * @param {HTMLElement} host
   * @param {object|string} current — existing value ({kind,dataUrl,name} or URL string or empty)
   * @param {{accept:string, maxSizeMB:number, label:string}} opts
   * @param {(value)=>void} onChange
   */
  function mountFilePicker(host, current, opts, onChange) {
    opts = Object.assign({ accept: "application/pdf", maxSizeMB: 5, label: "PDF 파일" }, opts);

    // Normalize current value
    let value = null;
    if (current) {
      if (typeof current === "object" && current.dataUrl) value = { kind: "file", ...current };
      else if (typeof current === "string" && current.startsWith("data:")) value = { kind: "file", dataUrl: current, name: "(파일)", size: 0 };
      else if (typeof current === "string" && current) value = { kind: "url", url: current };
    }

    function render() {
      const hasValue = !!value;
      let preview = "";
      if (hasValue) {
        if (value.kind === "file") {
          preview = `
            <div class="admin-file-card">
              <span class="admin-file-icon">📄</span>
              <div class="admin-file-info">
                <div class="admin-file-name">${escapeHtml(value.name || "파일")}</div>
                <div class="admin-file-meta">업로드됨 · ${formatBytes(value.size || (value.dataUrl?.length * 3 / 4))}</div>
              </div>
              <a href="${value.dataUrl}" download="${escapeAttr(value.name || 'file')}" class="btn btn-ghost btn-sm">↓ 다운로드</a>
            </div>`;
        } else {
          preview = `
            <div class="admin-file-card">
              <span class="admin-file-icon">🔗</span>
              <div class="admin-file-info">
                <div class="admin-file-name">${escapeHtml(value.url)}</div>
                <div class="admin-file-meta">외부 링크</div>
              </div>
              <a href="${value.url}" target="_blank" class="btn btn-ghost btn-sm">↗ 열기</a>
            </div>`;
        }
      }
      host.innerHTML = `
        <div class="admin-file-picker">
          ${preview}
          <div class="admin-file-actions">
            <label class="btn btn-primary btn-sm" style="cursor:pointer">
              📁 ${opts.label} 업로드
              <input type="file" accept="${opts.accept}" style="display:none" />
            </label>
            ${hasValue ? `<button type="button" class="btn btn-ghost btn-sm" data-action="clear">✕ 제거</button>` : ''}
          </div>
          <div class="admin-file-or">또는 외부 URL 직접 입력:</div>
          <input type="url" class="admin-file-url" placeholder="https://..." value="${value && value.kind === 'url' ? escapeAttr(value.url) : ''}" />
          <div class="admin-file-hint">
            ✅ 파일 업로드 시 JSON 안에 인라인 저장 (최대 ${opts.maxSizeMB}MB)<br/>
            💡 용량이 큰 파일은 Google Drive / Dropbox 공유 링크를 URL 로 넣으세요
          </div>
        </div>
      `;
      const fileInput = host.querySelector('input[type=file]');
      const urlInput = host.querySelector('.admin-file-url');
      fileInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > opts.maxSizeMB * 1024 * 1024) {
          toast(`파일이 ${opts.maxSizeMB}MB 를 초과합니다. 외부 URL 을 사용하세요.`, "error");
          fileInput.value = "";
          return;
        }
        try {
          const res = await readFileAsDataURL(file);
          value = { kind: "file", dataUrl: res.dataUrl, name: res.name, size: res.size };
          onChange(value);
          render();
          toast("파일 업로드 완료", "success");
        } catch (err) {
          toast(err.message, "error");
        }
        fileInput.value = "";
      };
      urlInput.oninput = () => {
        const v = urlInput.value.trim();
        if (!v) { value = null; onChange(null); return; }
        if (value && value.kind === "file") return; // don't overwrite uploaded file silently
        value = { kind: "url", url: v };
        onChange(value);
      };
      urlInput.onblur = () => {
        const v = urlInput.value.trim();
        if (v && (!value || value.kind === "url")) {
          value = { kind: "url", url: v };
          onChange(value);
          render();
        }
      };
      const clearBtn = host.querySelector('[data-action=clear]');
      if (clearBtn) clearBtn.onclick = () => {
        value = null;
        onChange(null);
        render();
      };
    }
    render();
    return {
      getValue: () => value,
      // For JSON serialization — returns a format friendly for current schema
      getSerialized: () => {
        if (!value) return "";
        if (value.kind === "file") return { name: value.name, dataUrl: value.dataUrl };
        return value.url;
      }
    };
  }

  /* =========================================================================
   * SHA-256 via WebCrypto
   * ========================================================================= */
  async function sha256(text) {
    const buf = new TextEncoder().encode(text);
    const hash = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
  }

  function getStoredHash() {
    return localStorage.getItem(LS_PW_HASH) || DEFAULT_PW_HASH;
  }

  /* =========================================================================
   * Login
   * ========================================================================= */
  async function handleLogin(e) {
    e.preventDefault();
    const pwInput = document.getElementById("password-input");
    const err = document.getElementById("login-error");
    const entered = pwInput.value;
    if (!entered) return;
    const enteredHash = await sha256(entered);
    if (enteredHash === getStoredHash()) {
      STATE.authed = true;
      document.getElementById("login-screen").classList.add("hidden");
      document.getElementById("dashboard").classList.remove("hidden");
      await loadAll();
      bindTabs();
      switchTab("publications");
    } else {
      err.textContent = "비밀번호가 맞지 않습니다.";
      pwInput.value = "";
      pwInput.focus();
    }
  }

  function logout() {
    STATE.authed = false;
    document.getElementById("login-screen").classList.remove("hidden");
    document.getElementById("dashboard").classList.add("hidden");
    document.getElementById("password-input").value = "";
    document.getElementById("login-error").textContent = "";
  }

  /* =========================================================================
   * Data loading
   * ========================================================================= */
  async function loadAll() {
    const fetchJSON = async (path) => {
      const res = await fetch(path + "?t=" + Date.now());
      if (!res.ok) throw new Error("Failed to load " + path);
      return res.json();
    };
    try {
      const [pubs, members, news, topics, config, pi] = await Promise.all([
        fetchJSON("data/publications.json"),
        fetchJSON("data/members.json"),
        fetchJSON("data/news.json"),
        fetchJSON("data/research_topics.json"),
        fetchJSON("data/config.json"),
        fetchJSON("data/pi.json")
      ]);
      STATE.data.publications = pubs;
      STATE.data.members = members;
      STATE.data.news = news;
      STATE.data.topics = topics;
      STATE.data.config = config;
      STATE.data.pi = pi;
    } catch (err) {
      toast("데이터를 불러오지 못했습니다: " + err.message, "error");
      console.error(err);
    }
  }

  /* =========================================================================
   * Download helpers
   * ========================================================================= */
  function downloadJSON(filename, obj) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
    toast(`${filename} 다운로드 완료. data/ 폴더에 교체하세요.`, "success");
  }

  async function copyJSON(obj) {
    try {
      await navigator.clipboard.writeText(JSON.stringify(obj, null, 2));
      toast("클립보드에 복사됨", "success");
    } catch {
      toast("복사 실패 — 브라우저 설정을 확인하세요", "error");
    }
  }

  /* =========================================================================
   * Tabs
   * ========================================================================= */
  function bindTabs() {
    document.querySelectorAll(".admin-tab").forEach(btn => {
      btn.addEventListener("click", () => switchTab(btn.dataset.tab));
    });
    document.getElementById("logout-btn").addEventListener("click", logout);
    document.getElementById("modal-close").addEventListener("click", closeModal);
    document.getElementById("modal-cancel").addEventListener("click", closeModal);
    document.getElementById("modal-save").addEventListener("click", () => {
      if (STATE.modal.onSave) STATE.modal.onSave();
    });
  }

  function switchTab(name) {
    STATE.currentTab = name;
    document.querySelectorAll(".admin-tab").forEach(b => b.classList.toggle("active", b.dataset.tab === name));
    document.querySelectorAll(".admin-tab-panel").forEach(p => p.classList.toggle("active", p.id === "tab-" + name));
    const renderer = { publications: renderPubs, members: renderMembers, pi: renderPI, news: renderNews, topics: renderTopics, config: renderConfig, settings: renderSettings }[name];
    if (renderer) renderer();
  }

  /* =========================================================================
   * Publications editor
   * ========================================================================= */
  function renderPubs() {
    const host = document.getElementById("tab-publications");
    const items = STATE.data.publications || [];
    host.innerHTML = `
      <div class="admin-section-head">
        <h2>논문 <span class="count">${items.length}편</span></h2>
        <div class="admin-section-actions">
          <button class="btn btn-outline" id="pub-add">+ 논문 추가</button>
          <button class="btn btn-primary" id="pub-save">💾 publications.json 저장</button>
        </div>
      </div>
      <table class="admin-table">
        <thead>
          <tr><th style="width:60px">연도</th><th>제목 · 저자 · 게재지</th><th style="width:100px">인용</th><th style="width:90px">유형</th><th style="width:160px">작업</th></tr>
        </thead>
        <tbody>
          ${items.map((p, i) => `
            <tr data-idx="${i}">
              <td>${p.year || ""}</td>
              <td>
                <div class="td-title">${escapeHtml(p.title || "")}${p.top_pick ? ' <span class="admin-badge accent">Top</span>' : ''}</div>
                <div class="td-dim">${escapeHtml(p.authors || "")} · <i>${escapeHtml(p.venue || "")}</i>${p.volume ? ", " + escapeHtml(p.volume) : ""}</div>
              </td>
              <td><b>${p.citations ?? 0}</b></td>
              <td><span class="admin-badge gray">${escapeHtml(p.type || "")}</span></td>
              <td class="row-actions">
                <button class="btn btn-ghost btn-sm" data-action="edit-pub" data-idx="${i}">편집</button>
                <button class="btn btn-ghost btn-sm" data-action="del-pub" data-idx="${i}" style="color:#cc0033">삭제</button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
    host.querySelector("#pub-add").onclick = () => editPub(-1);
    host.querySelector("#pub-save").onclick = () => downloadJSON("publications.json", STATE.data.publications);
    host.querySelectorAll("[data-action=edit-pub]").forEach(b => b.onclick = () => editPub(+b.dataset.idx));
    host.querySelectorAll("[data-action=del-pub]").forEach(b => b.onclick = () => {
      if (!confirm("이 논문을 삭제하시겠습니까?")) return;
      STATE.data.publications.splice(+b.dataset.idx, 1);
      renderPubs();
      toast("삭제됨. 반영하려면 JSON 저장을 눌러 다운로드하세요.", "success");
    });
  }

  function editPub(idx) {
    const isNew = idx === -1;
    const p = isNew ? { id: "p-" + Date.now(), type: "journal", top_pick: false, year: new Date().getFullYear(), title: "", authors: "", venue: "", volume: "", citations: 0, doi: "", link: "" } : { ...STATE.data.publications[idx] };
    const body = `
      <div class="admin-form">
        <div class="admin-form-row"><label>제목<span class="req">*</span></label><input id="f-title" value="${escapeAttr(p.title)}" /></div>
        <div class="admin-form-row"><label>저자<span class="req">*</span></label><input id="f-authors" value="${escapeAttr(p.authors)}" placeholder="J. Choi, P.J. Kim" /></div>
        <div class="admin-form-row"><label>게재지<span class="req">*</span></label><input id="f-venue" value="${escapeAttr(p.venue)}" placeholder="Advanced Energy Materials" /></div>
        <div class="admin-form-row"><label>권(호)</label><input id="f-volume" value="${escapeAttr(p.volume || '')}" placeholder="14(10)" /></div>
        <div class="admin-form-row"><label>연도<span class="req">*</span></label><input id="f-year" type="number" value="${p.year}" /></div>
        <div class="admin-form-row"><label>인용수</label><input id="f-citations" type="number" value="${p.citations || 0}" /></div>
        <div class="admin-form-row"><label>유형</label>
          <select id="f-type">
            <option value="journal" ${p.type==='journal'?'selected':''}>journal (저널)</option>
            <option value="conference" ${p.type==='conference'?'selected':''}>conference (학회)</option>
            <option value="book" ${p.type==='book'?'selected':''}>book (저서)</option>
            <option value="patent" ${p.type==='patent'?'selected':''}>patent (특허)</option>
          </select>
        </div>
        <div class="admin-form-row"><label>Top Pick</label>
          <div class="admin-checkbox"><input id="f-top" type="checkbox" ${p.top_pick ? 'checked' : ''} /> <label for="f-top">메인 화면 및 Top Picks 필터에 노출</label></div>
        </div>
        <div class="admin-form-row"><label>DOI</label><input id="f-doi" value="${escapeAttr(p.doi || '')}" placeholder="10.1002/aenm..." /></div>
        <div class="admin-form-row"><label>논문 PDF / 링크</label><div id="f-pdf-host"></div></div>
      </div>
    `;
    let pubPdfPicker;
    openModal(isNew ? "논문 추가" : "논문 편집", body, () => {
      const updated = {
        id: p.id,
        type: val("f-type"),
        top_pick: document.getElementById("f-top").checked,
        year: parseInt(val("f-year")) || new Date().getFullYear(),
        title: val("f-title"),
        authors: val("f-authors"),
        venue: val("f-venue"),
        volume: val("f-volume"),
        citations: parseInt(val("f-citations")) || 0,
        doi: val("f-doi"),
        link: pubPdfPicker.getSerialized()
      };
      if (!updated.title || !updated.authors || !updated.venue) return toast("필수 항목을 입력하세요", "error");
      if (isNew) STATE.data.publications.unshift(updated);
      else STATE.data.publications[idx] = updated;
      closeModal();
      renderPubs();
    });
    pubPdfPicker = mountFilePicker(
      document.getElementById("f-pdf-host"),
      typeof p.link === "object" ? p.link : (p.link || ""),
      { accept: "application/pdf,.pdf", maxSizeMB: 5, label: "논문 PDF" },
      () => {}
    );
  }

  /* =========================================================================
   * Members editor
   * ========================================================================= */
  const ROLE_LABELS = { professor: "교수", postdoc: "박사후", phd: "박사과정", ms: "석사과정", undergraduate: "학부연구원", alumni: "졸업생" };

  function renderMembers() {
    const host = document.getElementById("tab-members");
    const items = STATE.data.members || [];
    host.innerHTML = `
      <div class="admin-section-head">
        <h2>구성원 <span class="count">${items.length}명</span></h2>
        <div class="admin-section-actions">
          <button class="btn btn-outline" id="mem-add">+ 구성원 추가</button>
          <button class="btn btn-primary" id="mem-save">💾 members.json 저장</button>
        </div>
      </div>
      <table class="admin-table">
        <thead><tr><th>이름 (한/영)</th><th>구분</th><th>직함</th><th>이메일</th><th style="width:160px">작업</th></tr></thead>
        <tbody>
          ${items.map((m, i) => `
            <tr>
              <td><div class="td-title">${escapeHtml(m.name_ko || "")}</div><div class="td-dim">${escapeHtml(m.name_en || "")}</div></td>
              <td><span class="admin-badge">${ROLE_LABELS[m.role] || m.role}</span></td>
              <td class="td-dim">${escapeHtml(m.title_ko || m.title_en || "")}</td>
              <td class="td-dim">${escapeHtml(m.email || "")}</td>
              <td class="row-actions">
                <button class="btn btn-ghost btn-sm" data-action="edit-mem" data-idx="${i}">편집</button>
                <button class="btn btn-ghost btn-sm" data-action="del-mem" data-idx="${i}" style="color:#cc0033">삭제</button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
    host.querySelector("#mem-add").onclick = () => editMember(-1);
    host.querySelector("#mem-save").onclick = () => downloadJSON("members.json", STATE.data.members);
    host.querySelectorAll("[data-action=edit-mem]").forEach(b => b.onclick = () => editMember(+b.dataset.idx));
    host.querySelectorAll("[data-action=del-mem]").forEach(b => b.onclick = () => {
      if (!confirm("이 구성원을 삭제하시겠습니까?")) return;
      STATE.data.members.splice(+b.dataset.idx, 1);
      renderMembers();
    });
  }

  function editMember(idx) {
    const isNew = idx === -1;
    const m = isNew ? { id: "m-" + Date.now(), role: "ms", name_ko: "", name_en: "", title_ko: "", title_en: "", photo: "assets/images/members/placeholder.jpg", email: "", interests_ko: "", interests_en: "" } : { ...STATE.data.members[idx] };
    const body = `
      <div class="admin-form">
        <div class="admin-form-row"><label>구분<span class="req">*</span></label>
          <select id="f-role">
            ${Object.entries(ROLE_LABELS).map(([k, v]) => `<option value="${k}" ${m.role===k?'selected':''}>${v}</option>`).join("")}
          </select>
        </div>
        <div class="admin-form-row"><label>한글 이름<span class="req">*</span></label><input id="f-name-ko" value="${escapeAttr(m.name_ko)}" /></div>
        <div class="admin-form-row"><label>영문 이름<span class="req">*</span></label><input id="f-name-en" value="${escapeAttr(m.name_en)}" /></div>
        <div class="admin-form-row"><label>한글 직함</label><input id="f-title-ko" value="${escapeAttr(m.title_ko || '')}" placeholder="석사과정 (2026.03 – )" /></div>
        <div class="admin-form-row"><label>영문 직함</label><input id="f-title-en" value="${escapeAttr(m.title_en || '')}" placeholder="M.S. Student (2026.03 – )" /></div>
        <div class="admin-form-row"><label>이메일</label><input id="f-email" type="email" value="${escapeAttr(m.email || '')}" /></div>
        <div class="admin-form-row"><label>사진</label><div id="f-photo-host"></div></div>
        <div class="admin-form-row"><label>한글 관심분야</label><input id="f-int-ko" value="${escapeAttr(m.interests_ko || '')}" /></div>
        <div class="admin-form-row"><label>영문 관심분야</label><input id="f-int-en" value="${escapeAttr(m.interests_en || '')}" /></div>
      </div>
    `;
    let photoPicker;
    openModal(isNew ? "구성원 추가" : "구성원 편집", body, () => {
      const updated = {
        id: m.id, role: val("f-role"),
        name_ko: val("f-name-ko"), name_en: val("f-name-en"),
        title_ko: val("f-title-ko"), title_en: val("f-title-en"),
        email: val("f-email"), photo: photoPicker.getValue() || "",
        interests_ko: val("f-int-ko"), interests_en: val("f-int-en")
      };
      if (!updated.name_ko || !updated.name_en) return toast("한글/영문 이름은 필수입니다", "error");
      if (isNew) STATE.data.members.push(updated);
      else STATE.data.members[idx] = updated;
      closeModal();
      renderMembers();
    });
    photoPicker = mountImagePicker(
      document.getElementById("f-photo-host"),
      m.photo && !m.photo.includes("placeholder") ? m.photo : "",
      { maxW: 400, maxH: 400 },
      () => {}
    );
  }

  /* =========================================================================
   * PI profile editor
   * ========================================================================= */
  function renderPI() {
    const host = document.getElementById("tab-pi");
    const p = STATE.data.pi || {};
    host.innerHTML = `
      <div class="admin-section-head">
        <h2>PI 프로필</h2>
        <div class="admin-section-actions">
          <button class="btn btn-outline" id="pi-add-edu">+ 학력</button>
          <button class="btn btn-outline" id="pi-add-exp">+ 경력</button>
          <button class="btn btn-outline" id="pi-add-award">+ 수상</button>
          <button class="btn btn-outline" id="pi-add-grant">+ 연구 과제</button>
          <button class="btn btn-primary" id="pi-save">💾 pi.json 저장</button>
        </div>
      </div>

      <div class="admin-card">
        <h3>기본 정보</h3>
        <div class="admin-form">
          <div class="admin-form-row"><label>사진</label><div id="pi-photo-host"></div></div>
          <div class="admin-form-row"><label>한글 이름</label><input id="pi-name-ko" value="${escapeAttr(p.name_ko || '')}" /></div>
          <div class="admin-form-row"><label>영문 이름</label><input id="pi-name-en" value="${escapeAttr(p.name_en || '')}" /></div>
          <div class="admin-form-row"><label>한글 직함</label><input id="pi-title-ko" value="${escapeAttr(p.title_ko || '')}" /></div>
          <div class="admin-form-row"><label>영문 직함</label><input id="pi-title-en" value="${escapeAttr(p.title_en || '')}" /></div>
          <div class="admin-form-row"><label>한글 소속</label><input id="pi-aff-ko" value="${escapeAttr(p.affiliation_ko || '')}" /></div>
          <div class="admin-form-row"><label>영문 소속</label><input id="pi-aff-en" value="${escapeAttr(p.affiliation_en || '')}" /></div>
          <div class="admin-form-row"><label>이메일</label><input id="pi-email" type="email" value="${escapeAttr(p.email || '')}" /></div>
          <div class="admin-form-row"><label>CV 파일</label><div id="pi-cv-host"></div></div>
        </div>
      </div>

      <div class="admin-card">
        <h3>Bio (소개글)</h3>
        <div class="admin-form">
          <div class="admin-form-row full"><label>한글 Bio</label><textarea id="pi-bio-ko" style="min-height:140px">${escapeHtml(p.bio_ko || '')}</textarea></div>
          <div class="admin-form-row full"><label>영문 Bio</label><textarea id="pi-bio-en" style="min-height:140px">${escapeHtml(p.bio_en || '')}</textarea></div>
        </div>
      </div>

      <div class="admin-card">
        <h3>관심 연구 분야</h3>
        <div class="admin-form">
          <div class="admin-form-row full"><label>한글 (한 줄에 한 개)</label><textarea id="pi-int-ko">${escapeHtml((p.interests_ko || []).join('\n'))}</textarea></div>
          <div class="admin-form-row full"><label>영문 (한 줄에 한 개)</label><textarea id="pi-int-en">${escapeHtml((p.interests_en || []).join('\n'))}</textarea></div>
        </div>
      </div>

      <div class="admin-card">
        <h3>학력 <span style="font-weight:400;color:var(--color-text-light);font-size:.9em">${(p.education || []).length}개</span></h3>
        <div id="pi-edu-list">${renderEduList(p.education || [])}</div>
      </div>

      <div class="admin-card">
        <h3>경력 <span style="font-weight:400;color:var(--color-text-light);font-size:.9em">${(p.experience || []).length}개</span></h3>
        <div id="pi-exp-list">${renderExpList(p.experience || [])}</div>
      </div>

      <div class="admin-card">
        <h3>수상 <span style="font-weight:400;color:var(--color-text-light);font-size:.9em">${(p.awards || []).length}개</span></h3>
        <div id="pi-award-list">${renderAwardList(p.awards || [])}</div>
      </div>

      <div class="admin-card">
        <h3>수행 연구 과제 <span style="font-weight:400;color:var(--color-text-light);font-size:.9em">${(p.grants || []).length}건</span></h3>
        <div id="pi-grant-list">${renderGrantList(p.grants || [])}</div>
      </div>

      <div class="admin-card">
        <h3>외부 링크</h3>
        <div id="pi-links-list">${renderLinksList(p.links || [])}</div>
        <button class="btn btn-outline btn-sm" style="margin-top:var(--space-3)" id="pi-add-link">+ 링크 추가</button>
      </div>
    `;

    const photoPicker = mountImagePicker(
      document.getElementById("pi-photo-host"),
      p.photo || "",
      { maxW: 600, maxH: 800 },
      () => {}
    );

    const cvPicker = mountFilePicker(
      document.getElementById("pi-cv-host"),
      typeof p.cv === "object" ? p.cv : (p.cv_link || p.cv || ""),
      { accept: "application/pdf,.pdf", maxSizeMB: 5, label: "CV PDF" },
      () => {}
    );

    bindPIEditors();

    host.querySelector("#pi-save").onclick = () => {
      const updated = {
        ...p,
        name_ko: val("pi-name-ko"), name_en: val("pi-name-en"),
        title_ko: val("pi-title-ko"), title_en: val("pi-title-en"),
        affiliation_ko: val("pi-aff-ko"), affiliation_en: val("pi-aff-en"),
        email: val("pi-email"), cv: cvPicker.getSerialized(),
        bio_ko: val("pi-bio-ko"), bio_en: val("pi-bio-en"),
        interests_ko: val("pi-int-ko").split("\n").map(s => s.trim()).filter(Boolean),
        interests_en: val("pi-int-en").split("\n").map(s => s.trim()).filter(Boolean),
        photo: photoPicker.getValue() || p.photo || "",
        education: collectEduList(),
        experience: collectExpList(),
        awards: collectAwardList(),
        grants: collectGrantList(),
        links: collectLinksList()
      };
      STATE.data.pi = updated;
      downloadJSON("pi.json", updated);
    };

    host.querySelector("#pi-add-edu").onclick = () => {
      const list = collectEduList();
      list.push({ period: "", degree_ko: "", degree_en: "", field_ko: "", field_en: "", institution_ko: "", institution_en: "" });
      document.getElementById("pi-edu-list").innerHTML = renderEduList(list);
      bindPIEditors();
    };
    host.querySelector("#pi-add-exp").onclick = () => {
      const list = collectExpList();
      list.push({ period_ko: "", period_en: "", role_ko: "", role_en: "", org_ko: "", org_en: "" });
      document.getElementById("pi-exp-list").innerHTML = renderExpList(list);
      bindPIEditors();
    };
    host.querySelector("#pi-add-award").onclick = () => {
      const list = collectAwardList();
      list.push({ year: new Date().getFullYear(), title_ko: "", title_en: "", org_ko: "", org_en: "" });
      document.getElementById("pi-award-list").innerHTML = renderAwardList(list);
      bindPIEditors();
    };
    host.querySelector("#pi-add-grant").onclick = () => {
      const list = collectGrantList();
      list.push({ period_ko: "", period_en: "", title_ko: "", title_en: "", role_ko: "", role_en: "", agency_ko: "", agency_en: "" });
      document.getElementById("pi-grant-list").innerHTML = renderGrantList(list);
      bindPIEditors();
    };
    host.querySelector("#pi-add-link").onclick = () => {
      const list = collectLinksList();
      list.push({ label: "", url: "" });
      document.getElementById("pi-links-list").innerHTML = renderLinksList(list);
      bindPIEditors();
    };
  }

  function renderEduList(items) {
    return items.map((e, i) => `
      <div class="admin-list-row" data-i="${i}">
        <input placeholder="기간 (2010 – 2016)" data-k="period" value="${escapeAttr(e.period || '')}" />
        <input placeholder="학위 한글 (박사)" data-k="degree_ko" value="${escapeAttr(e.degree_ko || '')}" />
        <input placeholder="Degree EN (Ph.D.)" data-k="degree_en" value="${escapeAttr(e.degree_en || '')}" />
        <input placeholder="분야 한글" data-k="field_ko" value="${escapeAttr(e.field_ko || '')}" />
        <input placeholder="Field EN" data-k="field_en" value="${escapeAttr(e.field_en || '')}" />
        <input placeholder="학교 한글" data-k="institution_ko" value="${escapeAttr(e.institution_ko || '')}" />
        <input placeholder="Institution EN" data-k="institution_en" value="${escapeAttr(e.institution_en || '')}" />
        <button type="button" class="btn btn-ghost btn-sm" data-del="edu" style="color:#cc0033">✕</button>
      </div>
    `).join("");
  }
  function renderExpList(items) {
    return items.map((e, i) => `
      <div class="admin-list-row" data-i="${i}">
        <input placeholder="기간 한글 (2024 – 현재)" data-k="period_ko" value="${escapeAttr(e.period_ko || '')}" />
        <input placeholder="Period EN" data-k="period_en" value="${escapeAttr(e.period_en || '')}" />
        <input placeholder="직함 한글" data-k="role_ko" value="${escapeAttr(e.role_ko || '')}" />
        <input placeholder="Role EN" data-k="role_en" value="${escapeAttr(e.role_en || '')}" />
        <input placeholder="기관 한글" data-k="org_ko" value="${escapeAttr(e.org_ko || '')}" />
        <input placeholder="Org EN" data-k="org_en" value="${escapeAttr(e.org_en || '')}" />
        <button type="button" class="btn btn-ghost btn-sm" data-del="exp" style="color:#cc0033">✕</button>
      </div>
    `).join("");
  }
  function renderAwardList(items) {
    return items.map((e, i) => `
      <div class="admin-list-row" data-i="${i}">
        <input placeholder="연도" type="number" data-k="year" value="${e.year || new Date().getFullYear()}" style="max-width:90px" />
        <input placeholder="수상명 한글" data-k="title_ko" value="${escapeAttr(e.title_ko || '')}" />
        <input placeholder="Title EN" data-k="title_en" value="${escapeAttr(e.title_en || '')}" />
        <input placeholder="수여기관 한글" data-k="org_ko" value="${escapeAttr(e.org_ko || '')}" />
        <input placeholder="Issuing Org EN" data-k="org_en" value="${escapeAttr(e.org_en || '')}" />
        <button type="button" class="btn btn-ghost btn-sm" data-del="award" style="color:#cc0033">✕</button>
      </div>
    `).join("");
  }
  function renderGrantList(items) {
    return items.map((e, i) => `
      <div class="admin-list-row" data-i="${i}">
        <input placeholder="기간 한글 (2025 – 2028)" data-k="period_ko" value="${escapeAttr(e.period_ko || '')}" />
        <input placeholder="Period EN" data-k="period_en" value="${escapeAttr(e.period_en || '')}" />
        <input placeholder="과제명 한글" data-k="title_ko" value="${escapeAttr(e.title_ko || '')}" />
        <input placeholder="Title EN" data-k="title_en" value="${escapeAttr(e.title_en || '')}" />
        <input placeholder="역할 한글 (연구책임자)" data-k="role_ko" value="${escapeAttr(e.role_ko || '')}" />
        <input placeholder="Role EN (PI)" data-k="role_en" value="${escapeAttr(e.role_en || '')}" />
        <input placeholder="발주처 한글" data-k="agency_ko" value="${escapeAttr(e.agency_ko || '')}" />
        <input placeholder="Agency EN" data-k="agency_en" value="${escapeAttr(e.agency_en || '')}" />
        <button type="button" class="btn btn-ghost btn-sm" data-del="grant" style="color:#cc0033">✕</button>
      </div>
    `).join("");
  }
  function renderLinksList(items) {
    return items.map((e, i) => `
      <div class="admin-list-row" data-i="${i}">
        <input placeholder="레이블 (Google Scholar)" data-k="label" value="${escapeAttr(e.label || '')}" style="max-width:200px" />
        <input placeholder="URL" data-k="url" value="${escapeAttr(e.url || '')}" />
        <button type="button" class="btn btn-ghost btn-sm" data-del="link" style="color:#cc0033">✕</button>
      </div>
    `).join("");
  }

  function collectListRows(hostId) {
    const rows = document.querySelectorAll(`#${hostId} .admin-list-row`);
    return Array.from(rows).map(row => {
      const o = {};
      row.querySelectorAll("input").forEach(input => {
        const k = input.dataset.k;
        if (k) o[k] = input.type === "number" ? (parseInt(input.value) || 0) : input.value;
      });
      return o;
    });
  }
  const collectEduList = () => collectListRows("pi-edu-list");
  const collectExpList = () => collectListRows("pi-exp-list");
  const collectAwardList = () => collectListRows("pi-award-list");
  const collectGrantList = () => collectListRows("pi-grant-list");
  const collectLinksList = () => collectListRows("pi-links-list");

  function bindPIEditors() {
    document.querySelectorAll("[data-del]").forEach(btn => {
      btn.onclick = () => {
        const row = btn.closest(".admin-list-row");
        const parent = row.parentElement.id;
        row.remove();
      };
    });
  }

  /* =========================================================================
   * News editor
   * ========================================================================= */
  const NEWS_CAT_LABELS = { news: "뉴스", notice: "공지", seminar: "세미나" };

  function renderNews() {
    const host = document.getElementById("tab-news");
    const items = (STATE.data.news || []).slice().sort((a, b) => (a.date < b.date ? 1 : -1));
    host.innerHTML = `
      <div class="admin-section-head">
        <h2>소식 <span class="count">${items.length}건</span></h2>
        <div class="admin-section-actions">
          <button class="btn btn-outline" id="news-add">+ 소식 추가</button>
          <button class="btn btn-primary" id="news-save">💾 news.json 저장</button>
        </div>
      </div>
      <table class="admin-table">
        <thead><tr><th style="width:110px">날짜</th><th style="width:80px">분류</th><th>제목</th><th style="width:160px">작업</th></tr></thead>
        <tbody>
          ${items.map(n => {
            const realIdx = STATE.data.news.findIndex(x => x.id === n.id);
            return `
            <tr>
              <td class="td-dim" style="font-family:var(--font-mono)">${n.date}</td>
              <td><span class="admin-badge">${NEWS_CAT_LABELS[n.category] || n.category}</span></td>
              <td><div class="td-title">${escapeHtml(n.title_ko || "")}</div><div class="td-dim">${escapeHtml(n.title_en || "")}</div></td>
              <td class="row-actions">
                <button class="btn btn-ghost btn-sm" data-action="edit-news" data-idx="${realIdx}">편집</button>
                <button class="btn btn-ghost btn-sm" data-action="del-news" data-idx="${realIdx}" style="color:#cc0033">삭제</button>
              </td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    `;
    host.querySelector("#news-add").onclick = () => editNews(-1);
    host.querySelector("#news-save").onclick = () => downloadJSON("news.json", STATE.data.news);
    host.querySelectorAll("[data-action=edit-news]").forEach(b => b.onclick = () => editNews(+b.dataset.idx));
    host.querySelectorAll("[data-action=del-news]").forEach(b => b.onclick = () => {
      if (!confirm("이 소식을 삭제하시겠습니까?")) return;
      STATE.data.news.splice(+b.dataset.idx, 1);
      renderNews();
    });
  }

  function editNews(idx) {
    const isNew = idx === -1;
    const today = new Date().toISOString().slice(0, 10);
    const n = isNew ? { id: "n-" + Date.now(), date: today, category: "news", title_ko: "", title_en: "", body_ko: "", body_en: "" } : { ...STATE.data.news[idx] };
    const body = `
      <div class="admin-form">
        <div class="admin-form-row"><label>날짜<span class="req">*</span></label><input id="f-date" type="date" value="${n.date}" /></div>
        <div class="admin-form-row"><label>분류<span class="req">*</span></label>
          <select id="f-cat">
            ${Object.entries(NEWS_CAT_LABELS).map(([k, v]) => `<option value="${k}" ${n.category===k?'selected':''}>${v}</option>`).join("")}
          </select>
        </div>
        <div class="admin-form-row"><label>한글 제목<span class="req">*</span></label><input id="f-t-ko" value="${escapeAttr(n.title_ko)}" /></div>
        <div class="admin-form-row"><label>영문 제목</label><input id="f-t-en" value="${escapeAttr(n.title_en)}" /></div>
        <div class="admin-form-row full"><label>한글 본문</label><textarea id="f-b-ko">${escapeHtml(n.body_ko || "")}</textarea></div>
        <div class="admin-form-row full"><label>영문 본문</label><textarea id="f-b-en">${escapeHtml(n.body_en || "")}</textarea></div>
      </div>
    `;
    openModal(isNew ? "소식 추가" : "소식 편집", body, () => {
      const updated = {
        id: n.id, date: val("f-date"), category: val("f-cat"),
        title_ko: val("f-t-ko"), title_en: val("f-t-en"),
        body_ko: val("f-b-ko"), body_en: val("f-b-en")
      };
      if (!updated.date || !updated.title_ko) return toast("날짜와 한글 제목은 필수입니다", "error");
      if (isNew) STATE.data.news.unshift(updated);
      else STATE.data.news[idx] = updated;
      closeModal();
      renderNews();
    });
  }

  /* =========================================================================
   * Research topics editor (simpler, no SVG editing for safety)
   * ========================================================================= */
  function renderTopics() {
    const host = document.getElementById("tab-topics");
    const items = STATE.data.topics || [];
    host.innerHTML = `
      <div class="admin-section-head">
        <h2>연구 주제 <span class="count">${items.length}개</span></h2>
        <div class="admin-section-actions">
          <button class="btn btn-primary" id="topic-save">💾 research_topics.json 저장</button>
        </div>
      </div>
      <div class="admin-card" style="color:var(--color-text-muted);font-size:var(--fs-sm)">
        💡 SVG 도해는 코드 직접 수정이 필요합니다. 여기서는 제목/설명/키워드/대표논문만 편집 가능합니다.
      </div>
      ${items.map((t, i) => `
        <div class="admin-card">
          <div class="admin-section-head">
            <h3>${escapeHtml(t.title_ko)} <span class="td-dim">— ${escapeHtml(t.title_en)}</span></h3>
            <button class="btn btn-ghost btn-sm" data-action="edit-topic" data-idx="${i}">편집</button>
          </div>
          <p style="color:var(--color-text-muted);font-size:var(--fs-sm)">${escapeHtml(t.summary_ko)}</p>
          <div style="font-size:var(--fs-xs);color:var(--color-text-light);margin-top:.5rem">키워드: ${(t.keywords || []).join(", ")}</div>
        </div>
      `).join("")}
    `;
    host.querySelector("#topic-save").onclick = () => downloadJSON("research_topics.json", STATE.data.topics);
    host.querySelectorAll("[data-action=edit-topic]").forEach(b => b.onclick = () => editTopic(+b.dataset.idx));
  }

  function editTopic(idx) {
    const t = { ...STATE.data.topics[idx] };
    const body = `
      <div class="admin-form">
        <div class="admin-form-row"><label>한글 제목</label><input id="f-title-ko" value="${escapeAttr(t.title_ko)}" /></div>
        <div class="admin-form-row"><label>영문 제목</label><input id="f-title-en" value="${escapeAttr(t.title_en)}" /></div>
        <div class="admin-form-row full"><label>한글 설명</label><textarea id="f-sum-ko">${escapeHtml(t.summary_ko || "")}</textarea></div>
        <div class="admin-form-row full"><label>영문 설명</label><textarea id="f-sum-en">${escapeHtml(t.summary_en || "")}</textarea></div>
        <div class="admin-form-row"><label>키워드</label><input id="f-keys" value="${escapeAttr((t.keywords || []).join(', '))}" placeholder="쉼표로 구분" /></div>
        <div class="admin-form-row full"><label>대표 논문</label><textarea id="f-papers" class="code">${escapeHtml((t.representative_papers || []).join("\n"))}</textarea><div class="hint" style="margin-top:.25rem">한 줄에 한 편씩</div></div>
      </div>
    `;
    openModal("연구 주제 편집", body, () => {
      t.title_ko = val("f-title-ko");
      t.title_en = val("f-title-en");
      t.summary_ko = val("f-sum-ko");
      t.summary_en = val("f-sum-en");
      t.keywords = val("f-keys").split(",").map(s => s.trim()).filter(Boolean);
      t.representative_papers = val("f-papers").split("\n").map(s => s.trim()).filter(Boolean);
      STATE.data.topics[idx] = t;
      closeModal();
      renderTopics();
    });
  }

  /* =========================================================================
   * Config editor
   * ========================================================================= */
  function renderConfig() {
    const host = document.getElementById("tab-config");
    const c = STATE.data.config || {};
    host.innerHTML = `
      <div class="admin-section-head">
        <h2>기본 설정</h2>
        <div class="admin-section-actions">
          <button class="btn btn-primary" id="cfg-save">💾 config.json 저장</button>
        </div>
      </div>

      <div class="admin-card">
        <h3>연구실 정보</h3>
        <div class="admin-form">
          <div class="admin-form-row"><label>영문 이름</label><input id="c-name-en" value="${escapeAttr(c.lab?.name_en || '')}" /></div>
          <div class="admin-form-row"><label>한글 이름</label><input id="c-name-ko" value="${escapeAttr(c.lab?.name_ko || '')}" /></div>
          <div class="admin-form-row"><label>약칭</label><input id="c-short" value="${escapeAttr(c.lab?.short || '')}" /></div>
          <div class="admin-form-row"><label>영문 슬로건</label><input id="c-sl-en" value="${escapeAttr(c.lab?.slogan_en || '')}" /></div>
          <div class="admin-form-row"><label>한글 슬로건</label><input id="c-sl-ko" value="${escapeAttr(c.lab?.slogan_ko || '')}" /></div>
          <div class="admin-form-row"><label>영문 소속</label><input id="c-af-en" value="${escapeAttr(c.lab?.affiliation_en || '')}" /></div>
          <div class="admin-form-row"><label>한글 소속</label><input id="c-af-ko" value="${escapeAttr(c.lab?.affiliation_ko || '')}" /></div>
        </div>
      </div>

      <div class="admin-card">
        <h3>연락처</h3>
        <div class="admin-form">
          <div class="admin-form-row"><label>이메일</label><input id="c-email" type="email" value="${escapeAttr(c.contact?.email || '')}" /></div>
          <div class="admin-form-row"><label>한글 주소</label><input id="c-ad-ko" value="${escapeAttr(c.contact?.address_ko || '')}" /></div>
          <div class="admin-form-row"><label>영문 주소</label><input id="c-ad-en" value="${escapeAttr(c.contact?.address_en || '')}" /></div>
          <div class="admin-form-row"><label>한글 상세</label><input id="c-adx-ko" value="${escapeAttr(c.contact?.address_detail_ko || '')}" placeholder="건물/호수" /></div>
          <div class="admin-form-row"><label>영문 상세</label><input id="c-adx-en" value="${escapeAttr(c.contact?.address_detail_en || '')}" /></div>
          <div class="admin-form-row"><label>전화</label><input id="c-phone" value="${escapeAttr(c.contact?.phone || '')}" /></div>
          <div class="admin-form-row full"><label>Google Maps 임베드 URL</label><input id="c-maps" value="${escapeAttr(c.contact?.maps_embed || '')}" /></div>
        </div>
      </div>

      <div class="admin-card">
        <h3>연구실 대표 사진</h3>
        <p class="card-sub">홈 Hero 섹션 및 소셜 공유(OG) 이미지로 사용됩니다. 연구실 단체사진, 장비 전경 등. 가로형 추천.</p>
        <div id="c-hero-img-host"></div>
      </div>

      <div class="admin-card">
        <h3>Scholar 지표</h3>
        <p class="card-sub">Google Scholar 프로필에서 정기적으로 업데이트하세요.</p>
        <div class="admin-form">
          <div class="admin-form-row"><label>Citations 전체</label><input id="c-cit" type="number" value="${c.metrics?.citations_total || 0}" /></div>
          <div class="admin-form-row"><label>Citations 최근 5년</label><input id="c-cit5" type="number" value="${c.metrics?.citations_recent5y || 0}" /></div>
          <div class="admin-form-row"><label>h-index</label><input id="c-h" type="number" value="${c.metrics?.h_index || 0}" /></div>
          <div class="admin-form-row"><label>i10-index</label><input id="c-i10" type="number" value="${c.metrics?.i10_index || 0}" /></div>
          <div class="admin-form-row"><label>기준 (YYYY-MM)</label><input id="c-asof" value="${escapeAttr(c.metrics?.as_of || '')}" /></div>
        </div>
      </div>
    `;
    const heroImgPicker = mountImagePicker(
      document.getElementById("c-hero-img-host"),
      c.lab?.hero_image || "",
      { maxW: 1600, maxH: 900 },
      () => {}
    );

    host.querySelector("#cfg-save").onclick = () => {
      const c2 = { ...STATE.data.config };
      c2.lab = { ...c2.lab,
        name_en: val("c-name-en"), name_ko: val("c-name-ko"), short: val("c-short"),
        slogan_en: val("c-sl-en"), slogan_ko: val("c-sl-ko"),
        affiliation_en: val("c-af-en"), affiliation_ko: val("c-af-ko"),
        hero_image: heroImgPicker.getValue() || ""
      };
      c2.contact = { ...c2.contact,
        email: val("c-email"),
        address_ko: val("c-ad-ko"), address_en: val("c-ad-en"),
        address_detail_ko: val("c-adx-ko"), address_detail_en: val("c-adx-en"),
        phone: val("c-phone"), maps_embed: val("c-maps")
      };
      c2.metrics = { ...c2.metrics,
        citations_total: parseInt(val("c-cit")) || 0,
        citations_recent5y: parseInt(val("c-cit5")) || 0,
        h_index: parseInt(val("c-h")) || 0,
        i10_index: parseInt(val("c-i10")) || 0,
        as_of: val("c-asof")
      };
      STATE.data.config = c2;
      downloadJSON("config.json", c2);
    };
  }

  /* =========================================================================
   * Settings: password change, import, reset
   * ========================================================================= */
  function renderSettings() {
    const host = document.getElementById("tab-settings");
    host.innerHTML = `
      <div class="admin-section-head"><h2>관리자 설정</h2></div>

      <div class="admin-card">
        <h3>🔑 비밀번호 변경</h3>
        <p class="card-sub">새 비밀번호는 이 브라우저의 localStorage 에 해시로 저장됩니다. <b>잊어버리면 JavaScript 개발자도구로 <code>localStorage.removeItem('advemlab:admin:pwhash')</code> 실행 후 기본 비밀번호로 다시 로그인</b>하세요.</p>
        <div class="admin-form">
          <div class="admin-form-row"><label>현재 비밀번호</label><input id="pw-cur" type="password" /></div>
          <div class="admin-form-row"><label>새 비밀번호</label><input id="pw-new" type="password" /></div>
          <div class="admin-form-row"><label>새 비밀번호 확인</label><input id="pw-new2" type="password" /></div>
          <div class="admin-form-row full"><button class="btn btn-primary" id="pw-save">비밀번호 변경</button></div>
        </div>
      </div>

      <div class="admin-card">
        <h3>📥 JSON 가져오기</h3>
        <p class="card-sub">이전에 다운로드한 JSON 파일을 불러와서 에디터에 반영합니다. (실제 서버 데이터는 파일 교체 후 새로고침해야 반영됨)</p>
        <div class="admin-form">
          <div class="admin-form-row"><label>publications.json</label><input type="file" accept=".json" data-import="publications" /></div>
          <div class="admin-form-row"><label>members.json</label><input type="file" accept=".json" data-import="members" /></div>
          <div class="admin-form-row"><label>news.json</label><input type="file" accept=".json" data-import="news" /></div>
          <div class="admin-form-row"><label>research_topics.json</label><input type="file" accept=".json" data-import="topics" /></div>
          <div class="admin-form-row"><label>config.json</label><input type="file" accept=".json" data-import="config" /></div>
        </div>
      </div>

      <div class="admin-card">
        <h3>🚀 GitHub 자동 배포 (옵션)</h3>
        <p class="card-sub">사이트를 GitHub Pages 로 이전하면, 아래에 Personal Access Token 을 넣어 <b>저장</b> 시 바로 GitHub 에 commit 되도록 할 수 있습니다. 현재는 미지원 — GitHub Pages 전환 후 활성화 예정.</p>
        <div class="admin-form">
          <div class="admin-form-row"><label>GitHub repo</label><input disabled placeholder="owner/repo" /></div>
          <div class="admin-form-row"><label>PAT</label><input disabled placeholder="ghp_..." /></div>
        </div>
      </div>

      <div class="admin-card" style="border-color:#FFD699;background:#FFF7E6">
        <h3 style="color:#7A4E00">⚠️ 보안 안내</h3>
        <p style="color:#7A4E00;font-size:var(--fs-sm);line-height:1.7">
          이 관리자 페이지는 <b>소프트 게이트</b>입니다 — 학생들의 실수로 인한 편집을 막는 용도이며, 악의적 공격에 대한 보안은 아닙니다.
          비밀번호 해시가 JavaScript 소스에 노출되며, 다운로드된 JSON 은 누군가 서버에 업로드해야 실제 사이트에 반영됩니다.
          <b>진짜 인증</b>이 필요하면 GitHub Pages + Decap CMS (GitHub OAuth) 또는 Firebase Auth 같은 백엔드 솔루션을 검토하세요.
        </p>
      </div>
    `;
    host.querySelector("#pw-save").onclick = async () => {
      const cur = val("pw-cur"), n1 = val("pw-new"), n2 = val("pw-new2");
      if (!cur || !n1) return toast("모든 항목을 입력하세요", "error");
      if (n1.length < 8) return toast("새 비밀번호는 8자 이상", "error");
      if (n1 !== n2) return toast("새 비밀번호가 일치하지 않습니다", "error");
      const curHash = await sha256(cur);
      if (curHash !== getStoredHash()) return toast("현재 비밀번호가 맞지 않습니다", "error");
      const newHash = await sha256(n1);
      localStorage.setItem(LS_PW_HASH, newHash);
      toast("비밀번호가 변경되었습니다", "success");
      document.getElementById("pw-cur").value = "";
      document.getElementById("pw-new").value = "";
      document.getElementById("pw-new2").value = "";
    };
    host.querySelectorAll("[data-import]").forEach(input => {
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const key = e.target.dataset.import;
        const r = new FileReader();
        r.onload = () => {
          try {
            STATE.data[key] = JSON.parse(r.result);
            toast(`${key} 불러오기 완료`, "success");
            if (STATE.currentTab !== "settings") switchTab(STATE.currentTab);
          } catch (err) {
            toast("JSON 파싱 실패", "error");
          }
        };
        r.readAsText(file);
      };
    });
  }

  /* =========================================================================
   * Modal helpers
   * ========================================================================= */
  function openModal(title, bodyHTML, onSave) {
    document.getElementById("modal-title").textContent = title;
    document.getElementById("modal-body").innerHTML = bodyHTML;
    STATE.modal.onSave = onSave;
    document.getElementById("modal").classList.remove("hidden");
  }
  function closeModal() {
    document.getElementById("modal").classList.add("hidden");
    STATE.modal.onSave = null;
  }

  /* =========================================================================
   * Toast
   * ========================================================================= */
  let toastTimer;
  function toast(msg, type) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.className = "admin-toast show" + (type ? " " + type : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.className = "admin-toast"), 3000);
  }

  /* =========================================================================
   * Utils
   * ========================================================================= */
  function val(id) { const el = document.getElementById(id); return el ? el.value : ""; }
  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }
  function escapeAttr(s) { return escapeHtml(s); }

  /* =========================================================================
   * Boot
   * ========================================================================= */
  document.getElementById("login-form").addEventListener("submit", handleLogin);
})();
