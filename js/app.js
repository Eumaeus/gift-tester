(function () {
  const state = {
    source: null,
    questions: [],
    warnings: [],
    pageSize: 10,
    page: 0,
    results: {},
    showAnswers: false
  };

  const els = {
    select: document.getElementById("gift-select"),
    loadListed: document.getElementById("btn-load-listed"),
    loadFile: document.getElementById("btn-load-file"),
    fileInput: document.getElementById("file-input"),
    pageSize: document.getElementById("page-size"),
    prev: document.getElementById("btn-prev"),
    next: document.getElementById("btn-next"),
    pageLabel: document.getElementById("page-label"),
    jumpTo: document.getElementById("jump-to"),
    jump: document.getElementById("btn-jump"),
    showAnswers: document.getElementById("show-answers"),
    reload: document.getElementById("btn-reload"),
    exp: document.getElementById("btn-export"),
    status: document.getElementById("status-line"),
    warnings: document.getElementById("parse-warnings"),
    banner: document.getElementById("category-banner"),
    quiz: document.getElementById("quiz"),
    stats: document.getElementById("stats")
  };

  function setStatus(msg) {
    els.status.innerHTML = msg;
  }

  async function discoverGifts() {
    const names = new Set();
    try {
      const res = await fetch("gifts/manifest.json", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        (data.files || data).forEach((f) => names.add(String(f)));
      }
    } catch (_) { /* file:// or missing manifest */ }

    try {
      const res = await fetch("gifts/", { cache: "no-store" });
      if (res.ok) {
        const html = await res.text();
        for (const m of html.matchAll(/href="([^"]+\.gift)"/gi)) {
          names.add(decodeURIComponent(m[1].split("/").pop()));
        }
      }
    } catch (_) {}

    const list = [...names].sort();
    els.select.innerHTML = "";
    if (!list.length) {
      els.select.innerHTML = `<option value="">— none found —</option>`;
      return;
    }
    list.forEach((name) => {
      const opt = document.createElement("option");
      opt.value = `gifts/${name.replace(/^gifts\//, "")}`;
      opt.textContent = name.replace(/^gifts\//, "");
      els.select.appendChild(opt);
    });
  }

  function pageCount() {
    if (!state.questions.length) return 1;
    if (state.pageSize === Infinity) return 1;
    return Math.max(1, Math.ceil(state.questions.length / state.pageSize));
  }

  function visibleQuestions() {
    if (state.pageSize === Infinity) return state.questions;
    const start = state.page * state.pageSize;
    return state.questions.slice(start, start + state.pageSize);
  }

  function categorySummary() {
    const map = new Map();
    for (const q of state.questions) {
      const key = q.category || "(no $CATEGORY)";
      map.set(key, (map.get(key) || 0) + 1);
    }
    return [...map.entries()];
  }

  function updateStats() {
    let answered = 0, correct = 0, incorrect = 0, partial = 0;
    for (const q of state.questions) {
      const r = state.results[q.id];
      if (!r || !r.checked) continue;
      answered += 1;
      if (r.status === "correct") correct += 1;
      else if (r.status === "partial") partial += 1;
      else incorrect += 1;
    }
    els.stats.querySelector("[data-stat='total']").textContent = `${state.questions.length} questions`;
    els.stats.querySelector("[data-stat='answered']").textContent = `${answered} answered`;
    els.stats.querySelector("[data-stat='correct']").textContent = `${correct} correct`;
    els.stats.querySelector("[data-stat='incorrect']").textContent = `${incorrect} incorrect`;
    els.stats.querySelector("[data-stat='partial']").textContent = `${partial} partial`;

    const pages = pageCount();
    state.page = Math.min(state.page, pages - 1);
    els.pageLabel.textContent = state.questions.length
      ? `Page ${state.page + 1} / ${pages}`
      : "No quiz loaded";
    els.prev.disabled = state.page <= 0;
    els.next.disabled = state.page >= pages - 1;
    els.reload.disabled = !state.source;
    els.exp.disabled = !state.questions.length;
    els.jump.disabled = !state.questions.length;
  }

  function renderWarnings() {
    if (!state.warnings.length) {
      els.warnings.hidden = true;
      els.warnings.innerHTML = "";
      return;
    }
    const items = state.warnings.map((w) => {
      const snippet = w.snippet
        ? `<span class="snippet">${Gift.escapeHtml(w.snippet)}</span>`
        : "";
      return `<li><span class="line-no">Line ${w.line}</span> — ${Gift.escapeHtml(w.message)}${snippet}</li>`;
    }).join("");
    els.warnings.hidden = false;
    els.warnings.innerHTML = `<h2>${state.warnings.length} parse issue${state.warnings.length === 1 ? "" : "s"}</h2><ol>${items}</ol>`;
  }

  function renderBanner() {
    if (!state.questions.length) {
      els.banner.hidden = true;
      els.banner.innerHTML = "";
      return;
    }
    const cats = categorySummary();
    els.banner.hidden = false;
    els.banner.innerHTML = `
      <div class="label">Moodle categor${cats.length === 1 ? "y" : "ies"}</div>
      <div class="category-list">
        ${cats.map(([name, n]) =>
          `<span class="category-chip">${Gift.escapeHtml(name)} · ${n}</span>`
        ).join("")}
      </div>
    `;
  }

  function gradeQuestion(q) {
    const card = document.getElementById(q.id);
    if (q.type === "sa") {
      const given = card.querySelector("input[type='text']").value;
      const hit = q.answers.find((a) => Gift.answersMatch([a], given) && a.weight > 0);
      return {
        grade: hit ? hit.weight : 0,
        feedback: hit ? hit.feedback : "",
        selected: given
      };
    }
    const inputs = [...card.querySelectorAll("input[name='ans-" + q.id + "']")];
    const selected = inputs.filter((i) => i.checked).map((i) => Number(i.value));
    let grade = selected.reduce((sum, idx) => sum + (q.answers[idx]?.weight || 0), 0);
    grade = Math.max(0, Math.min(100, grade));
    const feedback = selected
      .map((idx) => q.answers[idx]?.feedback)
      .filter(Boolean)
      .join("\n\n");
    return { grade, feedback, selected };
  }

  function statusFromGrade(grade) {
    if (grade >= 99.999) return "correct";
    if (grade > 0) return "partial";
    return "incorrect";
  }

  function renderFeedback(q, result) {
    const card = document.getElementById(q.id);
    if (!card) return;
    const box = card.querySelector(".feedback");
    const labels = {
      correct: "Correct",
      partial: `Partially correct (${Math.round(result.grade)}%)`,
      incorrect: "Incorrect"
    };
    box.hidden = false;
    box.className = "feedback " + (result.status === "correct" ? "ok" : result.status === "partial" ? "mid" : "bad");
    box.innerHTML = `<div class="verdict">${labels[result.status]}</div>` +
      Gift.renderMarkdown(result.feedback || q.generalFeedback || "");

    card.classList.remove("is-correct", "is-incorrect", "is-partial");
    card.classList.add(result.status === "correct" ? "is-correct" : result.status === "partial" ? "is-partial" : "is-incorrect");

    if (q.type === "mc") {
      card.querySelectorAll(".choice").forEach((row, idx) => {
        row.classList.remove("mark-correct", "mark-wrong", "picked");
        const input = row.querySelector("input");
        if (input.checked) {
          row.classList.add(q.answers[idx].weight > 0 ? "mark-correct" : "mark-wrong", "picked");
        }
      });
    }
  }

  function applyReveal(card, q) {
    if (!state.showAnswers) return;
    if (q.type === "mc") {
      card.querySelectorAll(".choice").forEach((row, idx) => {
        const a = q.answers[idx];
        const tag = document.createElement("span");
        tag.className = "weight-tag";
        tag.textContent = a.weight > 0 ? `✓ ${a.weight}%` : `${a.weight}%`;
        row.appendChild(tag);
        if (a.weight > 0) row.classList.add("is-key");
      });
    } else {
      const accepted = q.answers.filter((a) => a.weight > 0).map((a) => a.text).join(" · ");
      const hint = document.createElement("div");
      hint.className = "sa-accepted";
      hint.textContent = "Accepted: " + accepted;
      card.querySelector(".body").appendChild(hint);
    }
  }

  function render(focusId) {
    els.quiz.innerHTML = "";
    renderWarnings();
    renderBanner();

    const startNum = state.pageSize === Infinity ? 1 : state.page * state.pageSize + 1;
    visibleQuestions().forEach((q, i) => {
      const num = startNum + i;
      const card = document.createElement("article");
      card.className = "question";
      card.id = q.id;
      const typeLabel = q.type === "sa"
        ? "short answer"
        : q.multiSelect ? "multiple choice (select all that apply)" : "multiple choice";
      const cat = q.category
        ? `<div class="q-category">${Gift.escapeHtml(q.category)}</div>`
        : "";
      card.innerHTML = `
        ${cat}
        <div class="q-meta">
          <span class="q-title">${Gift.escapeHtml(q.title)}</span>
          <span>${typeLabel} · #${num} · line ${q.line}</span>
        </div>
        <div class="q-stem">${Gift.renderMarkdown(q.stem)}</div>
        <div class="body"></div>
        <div class="q-actions"><button type="button" class="btn btn-primary btn-check">Check</button></div>
        <div class="feedback" hidden></div>
      `;
      const body = card.querySelector(".body");
      if (q.type === "sa") {
        body.innerHTML = `<div class="sa-row"><input type="text" autocomplete="off" spellcheck="false" placeholder="Type an answer" /></div>`;
      } else {
        const choices = document.createElement("div");
        choices.className = "choices";
        q.answers.forEach((a, idx) => {
          const row = document.createElement("label");
          row.className = "choice";
          row.innerHTML = `<input type="${q.multiSelect ? "checkbox" : "radio"}" name="ans-${q.id}" value="${idx}" />
            <span>${Gift.renderMarkdown(a.text)}</span>`;
          choices.appendChild(row);
        });
        body.appendChild(choices);
      }
      applyReveal(card, q);
      els.quiz.appendChild(card);

      const saved = state.results[q.id];
      if (saved && saved.checked) {
        if (q.type === "sa") card.querySelector("input[type='text']").value = saved.selected || "";
        else (saved.selected || []).forEach((idx) => {
          const input = card.querySelector(`input[value="${idx}"]`);
          if (input) input.checked = true;
        });
        renderFeedback(q, saved);
      }
    });
    updateStats();

    if (focusId) {
      const el = document.getElementById(focusId);
      if (el) {
        el.classList.add("flash");
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }

  function findQuestion(query) {
    const raw = String(query || "").trim();
    if (!raw) return null;
    const asNum = Number(raw.replace(/^#/, ""));
    if (Number.isInteger(asNum) && asNum >= 1 && asNum <= state.questions.length) {
      return state.questions[asNum - 1];
    }
    const needle = raw.replace(/^::|::$/g, "").toLowerCase();
    return state.questions.find((q) => q.title.toLowerCase() === needle) ||
      state.questions.find((q) => q.title.toLowerCase().includes(needle));
  }

  function jumpTo(query) {
    const q = findQuestion(query);
    if (!q) {
      setStatus(`No question matches “${Gift.escapeHtml(query)}”. Try a number (1–${state.questions.length}) or a title such as Q012.`);
      return;
    }
    if (state.pageSize !== Infinity) {
      state.page = Math.floor((q.index - 1) / state.pageSize);
    }
    render(q.id);
  }

  function loadParsed(text, source) {
    const parsed = Gift.parseGift(text);
    state.source = { ...source, text };
    state.questions = parsed.questions;
    state.warnings = parsed.warnings;
    state.results = {};
    state.page = Math.min(state.page, pageCount() - 1);
    const warn = parsed.warnings.length ? ` · ${parsed.warnings.length} parse issue${parsed.warnings.length === 1 ? "" : "s"}` : "";
    setStatus(`Loaded <strong>${Gift.escapeHtml(source.name)}</strong> · ${parsed.questions.length} questions · Adaptive mode (no penalties)${warn}`);
    render();
  }

  async function loadFromUrl(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Could not fetch ${url}`);
    const text = await res.text();
    loadParsed(text, { kind: "listed", name: url.split("/").pop(), url });
  }

  async function reloadQuiz() {
    if (!state.source) return;
    const keepPage = state.page;
    const keepSize = state.pageSize;
    const keepShow = state.showAnswers;
    try {
      if (state.source.file) {
        loadParsed(await state.source.file.text(), state.source);
      } else if (state.source.url) {
        await loadFromUrl(state.source.url);
      } else {
        loadParsed(state.source.text, state.source);
      }
      state.page = keepPage;
      state.pageSize = keepSize;
      state.showAnswers = keepShow;
      els.showAnswers.checked = keepShow;
      render();
    } catch (err) {
      setStatus(`Reload failed: ${err.message}`);
    }
  }

  function exportShuffled() {
    const gift = Gift.serializeGift(Gift.shuffledCopy(state.questions));
    const base = (state.source?.name || "quiz").replace(/\.gift$/i, "");
    const blob = new Blob([gift], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${base}-shuffled.gift`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  els.quiz.addEventListener("click", (ev) => {
    const btn = ev.target.closest(".btn-check");
    if (!btn) return;
    const card = ev.target.closest(".question");
    const q = state.questions.find((item) => item.id === card.id);
    const graded = gradeQuestion(q);
    const result = { ...graded, checked: true, status: statusFromGrade(graded.grade) };
    state.results[q.id] = result;
    renderFeedback(q, result);
    updateStats();
  });

  els.quiz.addEventListener("keydown", (ev) => {
    if (ev.key !== "Enter" || ev.target.tagName !== "INPUT") return;
    ev.preventDefault();
    ev.target.closest(".question")?.querySelector(".btn-check")?.click();
  });

  els.loadFile.addEventListener("click", () => els.fileInput.click());
  els.fileInput.addEventListener("change", async () => {
    const file = els.fileInput.files[0];
    if (!file) return;
    loadParsed(await file.text(), { kind: "picker", name: file.name, file });
    els.fileInput.value = "";
  });

  els.loadListed.addEventListener("click", async () => {
    if (!els.select.value) return;
    try { await loadFromUrl(els.select.value); }
    catch (err) { setStatus(`Could not open folder file. Use Load GIFT, or serve over HTTP. (${err.message})`); }
  });

  els.pageSize.addEventListener("change", () => {
    state.pageSize = els.pageSize.value === "all" ? Infinity : Number(els.pageSize.value);
    state.page = 0;
    render();
  });
  els.prev.addEventListener("click", () => { state.page -= 1; render(); window.scrollTo(0, 0); });
  els.next.addEventListener("click", () => { state.page += 1; render(); window.scrollTo(0, 0); });
  els.jump.addEventListener("click", () => jumpTo(els.jumpTo.value));
  els.jumpTo.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      jumpTo(els.jumpTo.value);
    }
  });
  els.showAnswers.addEventListener("change", () => {
    state.showAnswers = els.showAnswers.checked;
    render();
  });
  els.reload.addEventListener("click", reloadQuiz);
  els.exp.addEventListener("click", exportShuffled);

  discoverGifts();
})();