(function (global) {
  function unescapeGift(text) {
    return String(text || "").replace(/\\([~=#{}:])/g, "$1");
  }

  function escapeGift(text) {
    return String(text || "").replace(/([~=#{}])/g, "\\$1");
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  const ALLOWED_HTML_ATTRS = {
    br: [],
    hr: [],
    span: ["class", "style", "lang", "dir", "title"],
    div: ["class", "style", "lang", "dir", "title"],
    p: ["class", "style", "lang", "dir"],
    em: ["class", "style"],
    strong: ["class", "style"],
    b: ["class", "style"],
    i: ["class", "style"],
    u: ["class", "style"],
    s: ["class", "style"],
    sub: ["class", "style"],
    sup: ["class", "style"],
    small: ["class", "style"],
    mark: ["class", "style"],
    abbr: ["class", "title"],
    blockquote: ["class"],
    code: ["class"],
    pre: ["class"],
    ul: ["class"],
    ol: ["class", "start"],
    li: ["class"],
    table: ["class", "style"],
    thead: ["class"],
    tbody: ["class"],
    tr: ["class"],
    th: ["class", "colspan", "rowspan"],
    td: ["class", "colspan", "rowspan"],
    a: ["href", "title", "class", "target", "rel"],
    img: ["src", "alt", "title", "class", "width", "height", "style"]
  };

  function sanitizeTag(tag) {
    const parsed = String(tag).match(/^<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)\/?>$/);
    if (!parsed) return "";
    const name = parsed[1].toLowerCase();
    const allowed = ALLOWED_HTML_ATTRS[name];
    if (!allowed) return "";
    if (tag.startsWith("</")) return `</${name}>`;
    if (name === "br" || name === "hr") return `<${name}>`;

    const attrs = [];
    const attrRe = /([a-zA-Z:_][a-zA-Z0-9:_.-]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g;
    const rawAttrs = parsed[2] || "";
    let m;
    while ((m = attrRe.exec(rawAttrs))) {
      const attr = m[1].toLowerCase();
      if (!allowed.includes(attr) || attr.startsWith("on")) continue;
      const value = m[3] != null ? m[3] : m[4] != null ? m[4] : m[5];
      if ((attr === "href" || attr === "src") && /^\s*javascript:/i.test(value)) continue;
      attrs.push(`${attr}="${escapeHtml(value)}"`);
    }
    return `<${name}${attrs.length ? " " + attrs.join(" ") : ""}>`;
  }

  function renderMarkdown(src) {
    const placeholders = [];
    let s = String(src || "").replace(/<\/?[a-zA-Z][a-zA-Z0-9]*\b[^>]*>/g, (tag) => {
      const i = placeholders.length;
      placeholders.push(sanitizeTag(tag));
      return `\u0000H${i}\u0000`;
    });
    s = escapeHtml(s);
    s = s.replace(/\*\*([\s\S]+?)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    s = s.replace(/\n/g, "<br>");
    s = s.replace(/\u0000H(\d+)\u0000/g, (_, n) => placeholders[Number(n)]);
    return s;
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

    const hasTilde = /(^|\s)(?<!\\)~/.test(block);
    const type = hasTilde ? "mc" : "sa";
    const splitter = hasTilde ? /(?=(?<!\\)[~=])/ : /(?=(?<!\\)=)/;
    
    const parts = block.split(splitter).map((p) => p.trim()).filter(Boolean);
    const answers = [];

    for (const part of parts) {
      if (part.startsWith("~")) answers.push(parseAnswerChunk(part.slice(1), 0));
      else if (part.startsWith("=")) answers.push(parseAnswerChunk(part.slice(1), 100));
    }

    const positives = answers.filter((a) => a.weight > 0);
    const maxPos = positives.reduce((m, a) => Math.max(m, a.weight), 0);
    const multiSelect = type === "mc" && positives.length > 1 && maxPos < 100;
    return { type, answers, generalFeedback, multiSelect };
  }

  function classifyInner(inner) {
    const t = inner.trim();
    if (!t) return "empty";
    if (/^#/.test(t)) return "numeric";
    if (/->/.test(t)) return "matching";
    if (/^(TRUE|FALSE|T|F)\b/i.test(t) && !/~/.test(t) && !/=/.test(t)) return "tf";
    if (/(^|\s)~/.test(t) || /(^|\s)=/.test(t)) return "choice";
    return "unknown";
  }

  function extractBrace(buf) {
    let start = -1;
    let depth = 0;
    for (let k = 0; k < buf.length; k++) {
      const c = buf[k];
      if (c === "\\") { k++; continue; }
      if (c === "{") {
        if (start < 0) start = k;
        depth++;
      } else if (c === "}" && start >= 0) {
        depth--;
        if (depth === 0) {
          return {
            before: buf.slice(0, start),
            inner: buf.slice(start + 1, k),
            after: buf.slice(k + 1)
          };
        }
      }
    }
    return null;
  }

  function parseGift(source) {
    const warnings = [];
    const text = String(source || "").replace(/\r\n/g, "\n");
    const lines = text.split("\n");
    const questions = [];
    let category = "";
    let i = 0;

    function note(line, message, snippet) {
      warnings.push({ line, message, snippet: (snippet || "").trim().slice(0, 120) });
    }

    while (i < lines.length) {
      const rawLine = lines[i];
      const lineNo = i + 1;
      const trimmed = rawLine.trim();

      if (!trimmed || /^\s*\/\//.test(rawLine)) {
        i += 1;
        continue;
      }

      const cat = trimmed.match(/^\$CATEGORY:\s*(.*)$/);
      if (cat) {
        category = cat[1].trim();
        i += 1;
        continue;
      }

      let buf = rawLine;
      let j = i;
      let depth = 0;
      let seenOpen = false;
      let closed = false;

      scan:
      for (; j < lines.length; j++) {
        const L = j === i ? rawLine : lines[j];
        if (j !== i) buf += "\n" + L;
        for (let k = 0; k < L.length; k++) {
          if (L[k] === "\\") { k += 1; continue; }
          if (L[k] === "{") { depth += 1; seenOpen = true; }
          else if (L[k] === "}") {
            depth -= 1;
            if (seenOpen && depth === 0) {
              closed = true;
              break scan;
            }
          }
        }
      }

      if (!seenOpen) {
        note(lineNo, "Line is not a comment, $CATEGORY, or a question with `{...}`", rawLine);
        i += 1;
        continue;
      }

      if (!closed) {
        note(lineNo, "Unclosed `{` answer block", rawLine);
        i = j + 1;
        continue;
      }

      const extracted = extractBrace(buf);
      if (!extracted) {
        note(lineNo, "Could not extract a complete `{...}` block", rawLine);
        i = j + 1;
        continue;
      }

            const leftover = extracted.after.replace(/[ \t]*\/\/[^\n]*/g, "");
      const stemAfter = unescapeGift(leftover).replace(/\s+$/, "");
      // Embedded / missing-word text after `}` is part of the stem.
      // Do not warn unless it looks like another question started on the same line.
      if (/^\s*(\$CATEGORY:|::)/m.test(stemAfter)) {
        note(lineNo, "Extra text after closing `}` looks like another question and was ignored", leftover);
      }

      const header = extracted.before.trim();
      const head = header.match(/^::([^:]+)::(?:\[(\w+)\])?([\s\S]*)$/);
      if (!head) {
        note(lineNo, "Question is missing a `::title::` header", header);
        i = j + 1;
        continue;
      }

      const kind = classifyInner(extracted.inner);
      if (kind !== "choice") {
        const labels = {
          empty: "Empty answer block",
          numeric: "Numeric questions are not supported yet",
          matching: "Matching questions are not supported yet",
          tf: "True/false questions are not supported yet",
          unknown: "Unrecognized answer block"
        };
        note(lineNo, `${labels[kind] || "Skipped question"} (${head[1].trim()})`, extracted.inner);
        i = j + 1;
        continue;
      }

      const parsed = parseAnswerBlock(extracted.inner);
      if (!parsed.answers.length) {
        note(lineNo, `No answers parsed for ${head[1].trim()}`, extracted.inner);
        i = j + 1;
        continue;
      }

      questions.push({
        id: `q-${questions.length + 1}`,
        index: questions.length + 1,
        line: lineNo,
        title: head[1].trim(),
        format: (head[2] || "moodle").toLowerCase(),
        stem: unescapeGift(head[3] || "").replace(/^\s+/, "").replace(/\s+$/, " "),
        stemAfter: /^\s*(\$CATEGORY:|::)/m.test(stemAfter) ? "" : stemAfter,
        embedded: !!(stemAfter && !/^\s*(\$CATEGORY:|::)/m.test(stemAfter)),
        category,
        ...parsed
      });

      i = j + 1;
    }

    if (!questions.length) {
      note(1, "No multiple-choice or short-answer questions were found.", "");
    }

    return { questions, warnings };
  }

  function serializeGift(questions) {
    const lines = [];
    let lastCat = Symbol("none");
    for (const q of questions) {
      const cat = q.category || "";
      if (cat !== lastCat) {
        if (cat) {
          lines.push(`$CATEGORY: ${cat}`);
          lines.push("");
        }
        lastCat = cat;
      }
      const fmt = q.format && q.format !== "moodle" ? `[${q.format}]` : "";
      const after = q.stemAfter || "";
      lines.push(`::${q.title}::${fmt}${q.stem}{`);
      for (const a of q.answers) {
        const mark = q.type === "sa" ? "=" : "~";
        const prefix = a.weight === 100 && q.type === "sa" ? "=" : `${mark}%${a.weight}%`;
        const markOut = q.type === "sa" ? "=" : "~";
        lines.push(`\t${markOut}%${a.weight}%${escapeGift(a.text)}${a.feedback ? "#" + a.feedback : ""}`);
      }
      if (q.generalFeedback) lines.push(`####${q.generalFeedback}`);
      lines.push(`}${after}`);
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
    const groups = [];
    const index = new Map();
    for (const q of questions) {
      const key = q.category || "";
      if (!index.has(key)) {
        const items = [];
        index.set(key, items);
        groups.push({ key, items });
      }
      index.get(key).push(q);
    }
    return groups.flatMap((g) =>
      shuffle(g.items).map((q) => ({
        ...q,
        answers: q.type === "mc" ? shuffle(q.answers) : q.answers.slice()
      }))
    );
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

  function formatWarning(w) {
    const loc = w.line ? `Line ${w.line}` : "Parse";
    return w.snippet ? `${loc}: ${w.message} — ${w.snippet}` : `${loc}: ${w.message}`;
  }

  global.Gift = {
    parseGift,
    serializeGift,
    shuffledCopy,
    renderMarkdown,
    answersMatch,
    escapeHtml,
    formatWarning
  };
})(window);