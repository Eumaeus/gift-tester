(function (global) {
  function unescapeGift(text) {
    return String(text || "").replace(/\\([~=#{}:])/g, "$1");
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderMarkdown(src) {
    let s = escapeHtml(src || "");
    s = s.replace(/\*\*([\s\S]+?)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    s = s.replace(/\n/g, "<br>");
    return s;
  }

  function stripComments(src) {
    return src.replace(/^[ \t]*\/\/.*$/gm, "");
  }

  function parseAnswerChunk(chunk, defaultWeight) {
    let rest = chunk.trim();
    let weight = defaultWeight;
    const wm = rest.match(/^%(-?\d+(?:\.\d+)?)%/);
    if (wm) {
      weight = parseFloat(wm[1]);
      rest = rest.slice(wm[0].length).trim();
    }
    const hash = rest.search(/(?<!\\)#/);
    let text = rest;
    let feedback = "";
    if (hash >= 0) {
      text = rest.slice(0, hash);
      feedback = rest.slice(hash + 1);
    }
    return {
      weight,
      text: unescapeGift(text).trim(),
      feedback: unescapeGift(feedback).trim()
    };
  }

  function parseAnswerBlock(raw) {
    let block = raw.trim();
    let generalFeedback = "";
    const gf = block.match(/####([\s\S]*)$/);
    if (gf) {
      generalFeedback = unescapeGift(gf[1]).trim();
      block = block.slice(0, gf.index).trim();
    }

    const hasTilde = /(^|\s)~/.test(block);
    const type = hasTilde ? "mc" : "sa";
    const splitter = hasTilde ? /(?=~)/ : /(?==)/;
    const parts = block.split(splitter).map((p) => p.trim()).filter(Boolean);
    const answers = [];

    for (const part of parts) {
      if (part.startsWith("~")) {
        answers.push(parseAnswerChunk(part.slice(1), 0));
      } else if (part.startsWith("=")) {
        answers.push(parseAnswerChunk(part.slice(1), 100));
      }
    }

    const positives = answers.filter((a) => a.weight > 0);
    const maxPos = positives.reduce((m, a) => Math.max(m, a.weight), 0);
    const multiSelect = type === "mc" && positives.length > 1 && maxPos < 100;

    return { type, answers, generalFeedback, multiSelect };
  }

  function parseGift(source) {
    const warnings = [];
    const text = stripComments(String(source || "")).replace(/\r\n/g, "\n");
    const questions = [];
    let category = "";

    const re = /\$CATEGORY:\s*(.+)(?:\n|$)|::([^:]+)::(?:\[(\w+)\])?([\s\S]*?)\{([\s\S]*?)\}/g;
    let match;
    while ((match = re.exec(text))) {
      if (match[1] && match[2] == null) {
        category = match[1].trim();
        continue;
      }
      const title = match[2].trim();
      const format = (match[3] || "moodle").toLowerCase();
      const stem = unescapeGift(match[4]).trim();
      const parsed = parseAnswerBlock(match[5]);
      if (!parsed.answers.length) {
        warnings.push(`No answers parsed for ${title}`);
        continue;
      }
      if (parsed.type !== "mc" && parsed.type !== "sa") {
        warnings.push(`Skipping unsupported type for ${title}`);
        continue;
      }
      questions.push({
        id: `q-${questions.length + 1}`,
        title,
        format,
        stem,
        category,
        ...parsed
      });
    }

    if (!questions.length) {
      warnings.push("No multiple-choice or short-answer questions were found.");
    }
    return { questions, warnings };
  }

  function serializeGift(questions) {
    const lines = [];
    let lastCat = null;
    for (const q of questions) {
      if (q.category && q.category !== lastCat) {
        lines.push(`$CATEGORY: ${q.category}`);
        lines.push("");
        lastCat = q.category;
      }
      const fmt = q.format && q.format !== "moodle" ? `[${q.format}]` : "";
      lines.push(`::${q.title}::${fmt}${q.stem}{`);
      for (const a of q.answers) {
        const mark = q.type === "sa" ? "=" : "~";
        const weight = `%${a.weight}%`;
        const fb = a.feedback ? `#${a.feedback}` : "";
        lines.push(`\t${mark}${weight}${a.text}${fb}`);
      }
      if (q.generalFeedback) lines.push(`####${q.generalFeedback}`);
      lines.push("}");
      lines.push("");
    }
    return lines.join("\n");
  }

  function shuffle(arr, rng = Math.random) {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  function shuffledCopy(questions) {
    return shuffle(questions).map((q) => ({
      ...q,
      answers: q.type === "mc" ? shuffle(q.answers) : q.answers.slice()
    }));
  }

  function answersMatch(expected, given) {
    const norm = (s) => s.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();
    const g = norm(given);
    return expected.some((ans) => {
      const e = norm(ans.text);
      if (e.includes("*")) {
        const re = new RegExp("^" + e.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
        return re.test(g);
      }
      return e === g;
    });
  }

  global.Gift = {
    parseGift,
    serializeGift,
    shuffledCopy,
    renderMarkdown,
    answersMatch
  };
})(window);