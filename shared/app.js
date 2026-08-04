/* global ScormAPI, JSZip, LZString */
(function () {
  const APP_SUSPEND_KEY = "sos_portfolio_suspend_v2";
  const PERSONAL_CHOICE_REQUIRED = 2;
  const LAYOUT_VERSION = 3;
  const BACKUP_SEAL = "SOS-PORTFOLIO-SEAL-v2";
  /** Generous caps so reflections fit easily, while compressed LMS suspend_data stays under ~63k. */
  const CHAR_LIMIT_ENTRY = 8000;
  const CHAR_LIMIT_NOTES = 3000;

  let entries = {};
  let fieldsHydrated = false;
  let saveTimer = null;

  const POTENTIAL_RESOURCES = [
    { id: "book_reading_list", label: "Book reading list", url: "" },
    {
      id: "networking_list",
      label: "Networking list (3 professional + 3 personal contacts)",
      url: "",
    },
    { id: "air_component_commander_handbook", label: "Air Component Commander Handbook", url: "https://csl.armywarcollege.edu/content/docs/AirComponentCommanderHandbook.pdf" },
    { id: "the_joint_team", label: "The Joint Team", url: "https://www.airuniversity.af.edu/Portals/10/Foundational-Resources/The-Joint-Team.pdf" },
    { id: "afdp_1", label: "AFDP-1 The Air Force", url: "https://www.doctrine.af.mil/Portals/61/documents/AFDP_1/AFDP-1.pdf" },
    { id: "enlisted_force_structure", label: "The Enlisted Force Structure", url: "https://www.airuniversity.af.edu/Portals/10/Foundational-Resources/Enlisted-Force-Structure-Sep2025.pdf" },
    { id: "profession_of_arms", label: "A Profession of Arms: Our Core Values", url: "https://www.airuniversity.af.edu/Portals/10/Foundational-Resources/A-Profession-of-Arms.pdf" },
    { id: "doctrine_smart_book", label: "Doctrine Smart Book / Quick Reference", url: "https://www.doctrine.af.mil/Portals/61/AFDoctrineSmartBook.pdf" },
    { id: "full_range_leadership_model", label: "Full-Range Leadership Model", url: "https://www.airuniversity.af.edu/LinkClick.aspx?fileticket=BTtEDUvjjoY=&portalid=10" },
    { id: "afso21_cpi", label: "AFSO21 Continuous Process Improvement Playbook", url: "https://media.defense.gov/2009/Mar/27/2001453063/-1/-1/0/AFSO21%20Playbook%20(Full%20Version).pdf" },
    { id: "af_coaching_mentoring", label: "Air Force Coaching and Mentoring (DAFMAN 36-2643)", url: "https://static.e-publishing.af.mil/production/1/af_a1/publication/dafman36-2643/dafman36-2643.pdf" },
    { id: "tongue_and_quill", label: "Tongue and Quill Writing Guide", url: "https://www.e-publishing.af.mil/" },
    { id: "afi_1_1", label: "AFI 1-1: Air Force Standards", url: "https://static.e-publishing.af.mil/production/1/af_cc/publication/afi1-1/afi1-1.pdf" },
    { id: "dafi_36_2907", label: "DAFI 36-2907: Adverse Administrative Actions", url: "https://static.e-publishing.af.mil/production/1/af_a1/publication/dafi36-2907/dafi36-2907.pdf" },
    { id: "dafi_36_2903", label: "DAFI 36-2903: Dress and Personal Appearance", url: "https://static.e-publishing.af.mil/production/1/af_a1/publication/dafi36-2903/dafi36-2903.pdf" },
    { id: "afi_36_2406", label: "AFI 36-2406: Officer and Enlisted Evaluation Systems", url: "https://static.e-publishing.af.mil/production/1/af_a1/publication/afi36-2406/afi36-2406.pdf" },
    { id: "dafman_36_2806", label: "DAFMAN 36-2806: Military Awards Criteria and Procedures", url: "https://static.e-publishing.af.mil/production/1/af_a1/publication/dafman36-2806/dafman36-2806.pdf" },
    { id: "af_level_policy_updates", label: "AF Level Policy Updates", url: "https://www.af.mil/Policy-Updates/" },
    { id: "resilience_resources", label: "Resilience resources", url: "https://www.resilience.af.mil/" },
    { id: "officer_promotions", label: "Officer Promotions", url: "https://myfss.us.af.mil/USAFCommunity/s/knowledge-detail?pid=kA0t0000000wlCiCAI" },
    { id: "officer_de_resources", label: "Officer Developmental Education Resources", url: "https://myfss.us.af.mil/USAFCommunity/s/knowledge-detail?pid=kA0t0000000wlCuCAI" },
    { id: "officer_career_dev_categories", label: "USAF Officer Career Development", url: "https://myfss.us.af.mil/USAFCommunity/s/knowledge-detail?pid=kA0t0000000wldTCAQ" },
    { id: "af_negotiation_center", label: "Air Force Negotiation Center", url: "https://www.airuniversity.af.edu/AFNC/" },
    { id: "civilian_leadership_dev_center", label: "Civilian Leadership Development Center", url: "https://www.airuniversity.af.edu/CLDS/" },
    { id: "vector", label: "VECTOR", url: "https://www.airuniversity.af.edu/Vector/" },
    { id: "leader_development_course", label: "Leader Development Course (LDC)", url: "https://www.airuniversity.af.edu/Eaker-Center/CPDS/LDC/" },
    { id: "professional_reading", label: "Professional Reading for Air Force", url: "https://fairchild-mil.libguides.com/c.php?g=1186035&p=9704254" },
    { id: "other_fc_approved", label: "Other (Flight Commander approved)", url: "" },
  ];

  const ITEMS = [
    {
      id: "philosophy",
      title: "Leadership Philosophy",
      desc:
        "Developed from SOS activities in Developing Self & Others, Ethics for Warfighters, and Building and Leading Teams, plus mid-term feedback. Type or paste your entry below (saved to Canvas when you click Save), then mark complete when finished.",
      kind: "textEntry",
      required: true,
    },
    ...[1, 2, 3, 4].map((n) => ({
      id: `reflection_${n}`,
      title: `Weekly Leadership Reflection ${n}`,
      desc:
        n === 3
          ? "Project X reflection (required for this item). Consider: How was your leadership developed? Did you perform as expected? Were you adding or subtracting from the team’s success? Also cover your key insight and why it matters, how it connects to past experience, one strength and one improvement area, and one behavior to practice next week."
          : "Cover your most important leadership insight and why it matters, how it connects to past experience, one strength and one improvement area, and one leadership behavior to practice next week.",
      kind: "textEntry",
      required: true,
    })),
    ...[1, 2, 3].map((n) => ({
      id: `personal_choice_${n}`,
      title: `Personal choice resource ${n}`,
      desc:
        "Choose from the Potential Resources list (or a Flight Commander–approved alternative). At least two of the three personal-choice slots are required.",
      kind: "resourcePicker",
      required: true,
      group: "personal_choice",
    })),
    {
      id: "instructor_feedback",
      title: "Instructor Feedback (Optional)",
      desc: "OPTIONAL — not required for portfolio completion. Mark complete if you have received instructor feedback. Notes can be added below.",
      kind: "markComplete",
      required: false,
    },
    {
      id: "peer_feedback",
      title: "Peer Feedback (Optional)",
      desc: "OPTIONAL — not required for portfolio completion. Mark complete if you have received peer feedback. Notes can be added below.",
      kind: "markComplete",
      required: false,
    },
  ];

  function safeJsonParse(s, fallback) {
    try {
      return JSON.parse(s);
    } catch {
      return fallback;
    }
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function onEntriesChanged(opts) {
    const options = opts || {};
    if (!fieldsHydrated) return;
    updateItemChecksAll();
    updateHeaderAndScorm(entries);
    if (options.immediate) {
      saveProgress();
      return;
    }
    if (saveTimer) window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      saveProgress();
    }, 1200);
  }

  function updateItemChecksAll() {
    for (const item of ITEMS) updateItemCheck(item.id, entries);
  }

  function exportTextForItem(item, entry) {
    if (item.kind === "resourcePicker") {
      const res = POTENTIAL_RESOURCES.find((r) => r.id === entry.resourceId) || null;
      const picked = res?.label || "";
      const url = (entry.resourceUrlCustom || res?.url || "").trim();
      const notes = (entry.text || "").trim();
      return `Resource selection:\n${picked || "(none)"}\n\nLink:\n${url || "(none)"}\n\nNotes:\n${notes || "(none)"}\n`;
    }
    if (item.kind === "markComplete") {
      const notes = (entry.text || "").trim();
      const status = entry.manualCompleted ? "Marked complete: yes" : "Marked complete: no";
      return notes ? `${status}\n\nNotes:\n${notes}\n` : `${status}\n`;
    }
    return (entry.text || "").trim();
  }

  function buildCombinedExportText(entriesMap) {
    const parts = [];
    parts.push("SOS Leadership Portfolio — Canvas Submission");
    parts.push(`Exported: ${nowIso()}`);
    parts.push("");
    for (const item of ITEMS) {
      const e = entriesMap[item.id] || {};
      const content = exportTextForItem(item, e).trim();
      parts.push("=".repeat(72));
      parts.push(item.title);
      parts.push("=".repeat(72));
      parts.push(content || "(no entry)");
      parts.push("");
    }
    return parts.join("\n").trim() + "\n";
  }

  function safeFileName(name) {
    return String(name || "file")
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
      .slice(0, 150);
  }

  function markCompletePrereqMessage(item, entry) {
    const e = entry || {};
    if (item.group === "personal_choice") {
      const hasResource = typeof e.resourceId === "string" && e.resourceId.trim().length > 0;
      if (!hasResource) return "Select a resource before marking complete.";
      return "";
    }
    if (item.kind === "textEntry") {
      const hasText = typeof e.text === "string" && e.text.trim().length > 0;
      if (!hasText) return "Type or paste your entry before marking complete.";
      return "";
    }
    return "";
  }

  function canMarkComplete(item, entry) {
    return !markCompletePrereqMessage(item, entry);
  }

  function isItemSatisfied(item, entries, settings) {
    const e = entries[item.id] || {};
    const hasText = typeof e.text === "string" && e.text.trim().length > 0;
    const hasResource = typeof e.resourceId === "string" && e.resourceId.trim().length > 0;
    const manual = Boolean(e.manualCompleted);

    // Every section is complete only when Mark complete is checked (plus its prerequisites).
    if (!manual) return false;

    if (item.group === "personal_choice") return hasResource;
    if (item.kind === "markComplete") return true;
    if (item.kind === "textEntry") return hasText;
    return true;
  }

  function computeCompletion(entries, settings) {
    const requiredItems = ITEMS.filter((i) => i.required && i.group !== "personal_choice");
    const requiredOk = requiredItems.every((i) => isItemSatisfied(i, entries, settings));

    const personal = ITEMS.filter((i) => i.group === "personal_choice");
    const personalSatisfiedCount = personal.filter((i) => isItemSatisfied(i, entries, settings)).length;
    const personalOk = personalSatisfiedCount >= PERSONAL_CHOICE_REQUIRED;

    const totalRequiredCount = requiredItems.length + PERSONAL_CHOICE_REQUIRED;
    const doneCount = requiredItems.filter((i) => isItemSatisfied(i, entries, settings)).length +
      Math.min(personalSatisfiedCount, PERSONAL_CHOICE_REQUIRED);

    const pct = totalRequiredCount === 0 ? 0 : Math.round((doneCount / totalRequiredCount) * 100);
    return {
      done: requiredOk && personalOk,
      doneCount,
      totalRequiredCount,
      pct,
      personalSatisfiedCount,
    };
  }

  function setPill(el, state, text) {
    el.classList.remove("pill--good", "pill--warn", "pill--bad");
    if (state === "good") el.classList.add("pill--good");
    if (state === "warn") el.classList.add("pill--warn");
    if (state === "bad") el.classList.add("pill--bad");
    el.textContent = text;
  }

  function updateItemCheck(itemId, entries) {
    const item = ITEMS.find((i) => i.id === itemId);
    if (!item) return;
    const satisfied = isItemSatisfied(item, entries, {});
    const el = document.getElementById(`check-${itemId}`);
    if (!el) return;
    el.classList.toggle("check--done", satisfied);
  }

  function updateHeaderAndScorm(entries) {
    const completion = computeCompletion(entries, {});

    const pill = document.getElementById("pillState");
    const meta = document.getElementById("statusMeta");
    const bar = document.getElementById("progressBar");

    bar.style.width = `${completion.pct}%`;
    meta.textContent = `${completion.doneCount}/${completion.totalRequiredCount} required items satisfied • Score ${completion.pct}`;

    if (completion.done) {
      setPill(pill, "good", "Complete");
    } else if (completion.pct >= 50) {
      setPill(pill, "warn", "In progress");
    } else {
      setPill(pill, "bad", "Not complete");
    }
  }

  function textLimitForItem(item) {
    if (!item) return CHAR_LIMIT_ENTRY;
    if (item.kind === "resourcePicker" || item.kind === "markComplete") return CHAR_LIMIT_NOTES;
    return CHAR_LIMIT_ENTRY;
  }

  function clipText(value, limit) {
    const s = typeof value === "string" ? value : "";
    return s.length > limit ? s.slice(0, limit) : s;
  }

  function bindCharLimitedTextarea(ta, counterEl, limit, onValidInput) {
    ta.maxLength = limit;
    const syncCounter = () => {
      if (ta.value.length > limit) ta.value = ta.value.slice(0, limit);
      const n = ta.value.length;
      counterEl.textContent = `${n.toLocaleString()} / ${limit.toLocaleString()} characters`;
      counterEl.classList.toggle("char-count--near", n >= Math.floor(limit * 0.9));
      counterEl.classList.toggle("char-count--max", n >= limit);
    };
    ta.addEventListener("input", () => {
      syncCounter();
      onValidInput();
    });
    syncCounter();
  }

  function appendTextEntrySection(grid, item, e, entries, opts) {
    const options = opts || {};
    const limit = options.limit || textLimitForItem(item);
    const wrap = document.createElement("div");
    wrap.className = "entry-options entry-options--text";

    if (!options.skipBanner) {
      const banner = document.createElement("div");
      banner.className = "entry-options__banner";
      banner.innerHTML = options.bannerHtml ||
        "<strong>Type your entry</strong> below, then <strong>Mark complete</strong> to finish this section. Progress is saved to Canvas when you click <strong>Save</strong> (or Save &amp; Exit).";
      wrap.appendChild(banner);
    }

    const fieldText = document.createElement("label");
    fieldText.className = "field";
    const lab = document.createElement("div");
    lab.className = "field__label";
    lab.textContent = options.label || "Type or paste your entry";
    const ta = document.createElement("textarea");
    ta.value = clipText(e.text || "", limit);
    ta.placeholder = options.placeholder || "Type or paste your paper or reflection here…";
    const counter = document.createElement("div");
    counter.className = "char-count";
    bindCharLimitedTextarea(ta, counter, limit, () => {
      entries[item.id] = { ...entries[item.id], text: ta.value, updatedAt: nowIso() };
      if (typeof options.onTextChange === "function") options.onTextChange();
      onEntriesChanged();
      updateItemCheck(item.id, entries);
      updateHeaderAndScorm(entries);
    });
    const help = document.createElement("div");
    help.className = "field__help";
    help.textContent =
      options.helpText ||
      `Mark complete to finish this section. Limit ${limit.toLocaleString()} characters. Saved to Canvas with Save / Save & Exit.`;
    fieldText.appendChild(lab);
    fieldText.appendChild(ta);
    fieldText.appendChild(counter);
    fieldText.appendChild(help);
    wrap.appendChild(fieldText);
    grid.appendChild(wrap);
  }

  function renderItems(entries) {
    const root = document.getElementById("items");
    root.innerHTML = "";

    const settings = {};

    for (const item of ITEMS) {
      const e = entries[item.id] || {};
      const satisfied = isItemSatisfied(item, entries, settings);

      const wrap = document.createElement("div");
      wrap.className = "item";
      wrap.dataset.itemId = item.id;

      const top = document.createElement("div");
      top.className = "item__top";

      const left = document.createElement("div");
      const title = document.createElement("div");
      title.className = "item__title";
      title.textContent = item.title;

      const desc = document.createElement("div");
      desc.className = "item__desc";
      desc.textContent = item.desc;
      left.appendChild(title);
      left.appendChild(desc);

      const right = document.createElement("div");
      right.className = "item__right";
      const check = document.createElement("div");
      check.className = "check" + (satisfied ? " check--done" : "");
      check.id = `check-${item.id}`;
      right.appendChild(check);

      top.appendChild(left);
      top.appendChild(right);
      wrap.appendChild(top);

      const grid = document.createElement("div");
      grid.className = "grid";

      if (item.kind === "resourcePicker") {
        const fieldPick = document.createElement("label");
        fieldPick.className = "field";
        const lab = document.createElement("div");
        lab.className = "field__label";
        lab.textContent = "Select a potential resource";

        const sel = document.createElement("select");
        sel.className = "input input--resource";
        const opt0 = document.createElement("option");
        opt0.value = "";
        opt0.textContent = "— Select one —";
        sel.appendChild(opt0);

        for (const r of POTENTIAL_RESOURCES) {
          const opt = document.createElement("option");
          opt.value = r.id;
          const hasUrl = Boolean(String(r.url || "").trim());
          opt.textContent = hasUrl ? `${r.label} [link]` : r.label;
          sel.appendChild(opt);
        }
        sel.value = e.resourceId || "";
        sel.addEventListener("change", () => {
          entries[item.id] = { ...entries[item.id], resourceId: sel.value, updatedAt: nowIso() };
          onEntriesChanged();
          renderAll(entries);
        });

        const help = document.createElement("div");
        help.className = "field__help";
        help.textContent = "Click Save to store this selection in Canvas.";

        fieldPick.appendChild(lab);
        fieldPick.appendChild(sel);
        fieldPick.appendChild(help);
        grid.appendChild(fieldPick);

        const linkWrap = document.createElement("div");
        linkWrap.className = "field";
        const linkLab = document.createElement("div");
        linkLab.className = "field__label";
        linkLab.textContent = "Link";
        const linkRow = document.createElement("div");
        linkRow.className = "row row--wrap";

        const res = POTENTIAL_RESOURCES.find((r) => r.id === (e.resourceId || "")) || null;
        const computedUrl = (e.resourceUrlCustom || res?.url || "").trim();

        const linkText = document.createElement("div");
        linkText.className = "muted";
        linkText.style.wordBreak = "break-word";
        linkText.textContent = computedUrl || "—";

        const openBtn = document.createElement("a");
        openBtn.className = "btn btn--ghost";
        openBtn.textContent = "Open link";
        openBtn.target = "_blank";
        openBtn.rel = "noopener noreferrer";
        if (computedUrl) {
          openBtn.href = computedUrl;
        } else {
          openBtn.href = "#";
          openBtn.setAttribute("aria-disabled", "true");
          openBtn.style.pointerEvents = "none";
          openBtn.style.opacity = "0.6";
        }

        linkRow.appendChild(openBtn);
        linkRow.appendChild(linkText);

        linkWrap.appendChild(linkLab);
        linkWrap.appendChild(linkRow);

        if ((e.resourceId || "") === "other_fc_approved") {
          const urlField = document.createElement("input");
          urlField.className = "input";
          urlField.type = "url";
          urlField.placeholder = "Paste URL for Flight Commander-approved resource";
          urlField.value = e.resourceUrlCustom || "";
          urlField.addEventListener("input", () => {
            entries[item.id] = { ...entries[item.id], resourceUrlCustom: urlField.value, updatedAt: nowIso() };
            onEntriesChanged();
            renderAll(entries);
          });
          linkWrap.appendChild(urlField);
        }

        grid.appendChild(linkWrap);

        const fieldNotes = document.createElement("label");
        fieldNotes.className = "field field--full";
        const labNotes = document.createElement("div");
        labNotes.className = "field__label";
        labNotes.textContent = "Notes / details";
        const ta = document.createElement("textarea");
        const notesLimit = textLimitForItem(item);
        ta.value = clipText(e.text || "", notesLimit);
        ta.placeholder = "Add notes (e.g., why you chose it, link, key takeaways)…";
        const counterNotes = document.createElement("div");
        counterNotes.className = "char-count";
        bindCharLimitedTextarea(ta, counterNotes, notesLimit, () => {
          entries[item.id] = { ...entries[item.id], text: ta.value, updatedAt: nowIso() };
          onEntriesChanged();
          updateItemCheck(item.id, entries);
          updateHeaderAndScorm(entries);
        });
        const helpNotes = document.createElement("div");
        helpNotes.className = "field__help";
        helpNotes.textContent = `Limit ${notesLimit.toLocaleString()} characters. Click Save to store in Canvas.`;
        fieldNotes.appendChild(labNotes);
        fieldNotes.appendChild(ta);
        fieldNotes.appendChild(counterNotes);
        fieldNotes.appendChild(helpNotes);
        grid.appendChild(fieldNotes);
      } else if (item.kind === "textEntry") {
        appendTextEntrySection(grid, item, e, entries, {
          onTextChange: () => refreshManualGate(),
        });
      } else if (item.kind === "markComplete") {
        appendTextEntrySection(grid, item, e, entries, {
          skipBanner: true,
          label: "Optional notes",
          placeholder: "Optional notes about this feedback item…",
          helpText: `Optional. Limit ${CHAR_LIMIT_NOTES.toLocaleString()} characters.`,
        });
      }

      const fieldManual = document.createElement("label");
      fieldManual.className = "mark-complete field--full";
      const lab3 = document.createElement("div");
      lab3.className = "mark-complete__label";
      lab3.textContent = "Mark complete";
      const manualWrap = document.createElement("div");
      manualWrap.className = "mark-complete__row";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.className = "mark-complete__checkbox";
      cb.checked = Boolean(e.manualCompleted);
      const manualText = document.createElement("div");
      manualText.className = "mark-complete__hint";
      manualText.textContent = "Check when this item is finalized.";

      function syncMarkCompleteVisual() {
        const done = Boolean(cb.checked);
        const blocked = Boolean(cb.disabled);
        fieldManual.classList.toggle("mark-complete--done", done);
        fieldManual.classList.toggle("mark-complete--pending", !done && !blocked);
        fieldManual.classList.toggle("mark-complete--blocked", blocked);
        fieldManual.classList.toggle("field--disabled", blocked);
        lab3.textContent = done ? "Marked complete" : "Mark complete — required to finish this section";
        if (item.required === false && !blocked) {
          lab3.textContent = done ? "Marked complete (optional)" : "Mark complete (optional)";
        }
      }

      function refreshManualGate() {
        const prereqMsg = markCompletePrereqMessage(item, entries[item.id]);
        const ok = !prereqMsg;
        cb.disabled = !ok;
        if (!ok) {
          if (cb.checked || (entries[item.id] || {}).manualCompleted) {
            cb.checked = false;
            entries[item.id] = { ...entries[item.id], manualCompleted: false, updatedAt: nowIso() };
          }
          manualText.textContent = prereqMsg;
        } else {
          manualText.textContent = item.required
            ? "Click the box to mark this section complete."
            : "Optional — check only if you want to record this feedback.";
        }
        syncMarkCompleteVisual();
      }

      cb.addEventListener("change", () => {
        if (!canMarkComplete(item, entries[item.id])) {
          cb.checked = false;
          refreshManualGate();
          return;
        }
        entries[item.id] = { ...entries[item.id], manualCompleted: cb.checked, updatedAt: nowIso() };
        syncMarkCompleteVisual();
        onEntriesChanged();
        updateItemCheck(item.id, entries);
        updateHeaderAndScorm(entries);
      });
      manualWrap.appendChild(cb);
      manualWrap.appendChild(manualText);
      fieldManual.appendChild(lab3);
      fieldManual.appendChild(manualWrap);
      grid.appendChild(fieldManual);
      refreshManualGate();

      wrap.appendChild(grid);
      root.appendChild(wrap);
    }
  }

function sanitizeEntriesForPersist(src) {
    const out = {};
    for (const item of ITEMS) {
      const e = (src && src[item.id]) || {};
      out[item.id] = {
        text: clipText(typeof e.text === "string" ? e.text : "", textLimitForItem(item)),
        resourceId: typeof e.resourceId === "string" ? e.resourceId : "",
        resourceUrlCustom: typeof e.resourceUrlCustom === "string" ? e.resourceUrlCustom : "",
        manualCompleted: Boolean(e.manualCompleted),
        updatedAt: e.updatedAt || null,
      };
    }
    return out;
  }

  function buildProgressPayload() {
    const completion = computeCompletion(entries, { personalChoiceRequired: PERSONAL_CHOICE_REQUIRED });
    return {
      key: APP_SUSPEND_KEY,
      _layoutVersion: LAYOUT_VERSION,
      _savedAt: Date.now(),
      settings: { personalChoiceRequired: PERSONAL_CHOICE_REQUIRED },
      completion: {
        done: completion.done,
        pct: completion.pct,
        doneCount: completion.doneCount,
        totalRequiredCount: completion.totalRequiredCount,
      },
      _data: sanitizeEntriesForPersist(entries),
    };
  }

  function applySavedState(saved) {
    if (!saved || typeof saved !== "object") return;
    // Prefer full entries in _data (v2). Fall back to legacy completedMap-only stubs.
    if (saved._data && typeof saved._data === "object") {
      entries = sanitizeEntriesForPersist(saved._data);
      return;
    }
    if (saved.entries && typeof saved.entries === "object") {
      entries = sanitizeEntriesForPersist(saved.entries);
      return;
    }
    // Discard metadata-only stubs from older packages (no real answers).
    if (saved._externalData || saved.completedMap) {
      console.warn("Ignoring metadata-only / legacy incomplete SCORM stub.");
    }
  }

  function fnv1aHash(str) {
    let h = 0x811c9dc5;
    const s0 = String(str || "");
    for (let i = 0; i < s0.length; i++) {
      h ^= s0.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return ("00000000" + h.toString(16)).slice(-8);
  }

  function backupSignature(learnerId, sealedBody) {
    return fnv1aHash(BACKUP_SEAL + "|" + String(learnerId || "") + "|" + String(sealedBody || ""));
  }

  function encodeBackupBody(innerObj) {
    const json = JSON.stringify(innerObj);
    if (typeof LZString !== "undefined") {
      return LZString.compressToEncodedURIComponent(json);
    }
    try {
      return btoa(unescape(encodeURIComponent(json)));
    } catch {
      return json;
    }
  }

  function decodeBackupBody(sealedBody) {
    if (!sealedBody) return null;
    try {
      if (typeof LZString !== "undefined") {
        const json = LZString.decompressFromEncodedURIComponent(String(sealedBody));
        if (json) return JSON.parse(json);
      }
      try {
        return JSON.parse(decodeURIComponent(escape(atob(String(sealedBody)))));
      } catch {
        return JSON.parse(String(sealedBody));
      }
    } catch {
      return null;
    }
  }

  function currentLearnerId() {
    return typeof ScormAPI.getLearnerId === "function" ? String(ScormAPI.getLearnerId() || "").trim() : "";
  }

  function currentLearnerName() {
    return typeof ScormAPI.getLearnerName === "function" ? String(ScormAPI.getLearnerName() || "").trim() : "";
  }

  function sealBackupForDownload(innerPayload) {
    let learnerId = currentLearnerId();
    if (ScormAPI.isAvailable() && !learnerId) {
      return { error: "Canvas did not provide a student ID, so a secure backup cannot be created yet. Try Save again in a moment." };
    }
    if (!learnerId) learnerId = "standalone";
    const sealedBody = encodeBackupBody(innerPayload || buildProgressPayload());
    return {
      file: {
        _sosPortfolioBackup: true,
        _backupVersion: 2,
        _learnerId: learnerId,
        _learnerName: currentLearnerName(),
        _savedAt: Date.now(),
        _sealed: sealedBody,
        _sig: backupSignature(learnerId, sealedBody),
      },
    };
  }

  function unsealBackupFile(obj) {
    if (!obj || typeof obj !== "object" || obj._sosPortfolioBackup !== true) {
      return { error: "That file does not look like an SOS Leadership Portfolio backup." };
    }
    if (!obj._sealed || Number(obj._backupVersion) < 2) {
      return {
        error:
          "This backup format is no longer accepted.\n\nCreate a new backup with Save & Exit in your own Canvas session, then use that file.",
      };
    }
    let myId = currentLearnerId();
    if (ScormAPI.isAvailable() && !myId) {
      return { error: "Canvas did not provide your student ID, so restore is blocked. Re-open the assignment and try again." };
    }
    if (!myId) myId = "standalone";
    const fileId = String(obj._learnerId || "").trim();
    if (!fileId || fileId !== myId) {
      return {
        error:
          "This backup belongs to another student and cannot be restored.\n\nEach backup only works for the Canvas account that downloaded it.",
      };
    }
    if (obj._sig !== backupSignature(fileId, obj._sealed)) {
      return {
        error:
          "This backup file failed the integrity check (it may have been edited).\n\nDownload a fresh backup with Save & Exit from your own account.",
      };
    }
    const inner = decodeBackupBody(obj._sealed);
    if (!inner || typeof inner !== "object") {
      return { error: "Could not read the contents of that backup file." };
    }
    return { payload: inner };
  }

  function downloadBackupFile() {
    try {
      const sealed = sealBackupForDownload(buildProgressPayload());
      if (sealed.error) {
        alert(sealed.error);
        return false;
      }
      const json = JSON.stringify(sealed.file, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const d = new Date();
      const stamp =
        d.getFullYear() +
        "-" +
        String(d.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(d.getDate()).padStart(2, "0") +
        "_" +
        String(d.getHours()).padStart(2, "0") +
        String(d.getMinutes()).padStart(2, "0");
      const safeId = (currentLearnerId() || "student").replace(/[^\w\-.@]/g, "_").slice(0, 24);
      const a = document.createElement("a");
      a.href = url;
      a.download = "SOS-Portfolio-backup-" + safeId + "-" + stamp + ".json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return true;
    } catch (e) {
      console.warn("Backup download failed", e);
      return false;
    }
  }

  function updateLmsSaveStatus(result) {
    const headerEl = document.getElementById("lmsSaveStatus");
    const floatEl = document.getElementById("lmsSaveStatusFloat");
    const version = (result && result.version) || ScormAPI.getVersion() || "none";
    let text;
    let tone = "neutral";
    if (!ScormAPI.isAvailable()) {
      text = "Offline — use Save & Exit for backup";
      tone = "warn";
    } else if (result && result.scormOk && result.verified) {
      text = "Canvas save OK · SCORM " + version;
      tone = "ok";
    } else if (result && result.scormOk && !result.verified) {
      text = "Canvas pending · use Save & Exit · SCORM " + version;
      tone = "warn";
    } else if (result && result.tooLarge) {
      text = "Canvas save blocked (too large) · SCORM " + version;
      tone = "bad";
    } else if (result && result.scormOk === false && typeof result.compressedLength === "number") {
      text = "Canvas save failed · SCORM " + version;
      tone = "bad";
    } else {
      text = "SCORM " + version + " connected";
      tone = "neutral";
    }
    if (headerEl) {
      headerEl.textContent = text;
      headerEl.className =
        "lms-save-status" +
        (tone === "ok" ? " lms-save-ok" : tone === "warn" ? " lms-save-warn" : tone === "bad" ? " lms-save-bad" : "");
    }
    if (floatEl) {
      floatEl.textContent = text;
      floatEl.className =
        "save-float__status" +
        (tone === "ok" ? " save-float__status--ok" : tone === "warn" ? " save-float__status--warn" : tone === "bad" ? " save-float__status--bad" : "");
    }
  }

  function syncCompletionToLms(completion) {
    if (!ScormAPI.isAvailable()) return;
    if (completion.done) {
      ScormAPI.setComplete(completion.pct);
    } else {
      ScormAPI.setScore(completion.pct);
      ScormAPI.setIncomplete();
    }
  }

  function saveProgress() {
    if (!fieldsHydrated) return null;
    const completion = computeCompletion(entries, { personalChoiceRequired: PERSONAL_CHOICE_REQUIRED });
    const result = ScormAPI.saveSuspendData(buildProgressPayload());
    syncCompletionToLms(completion);
    updateHeaderAndScorm(entries);
    updateLmsSaveStatus(result);
    return result;
  }

  function restoreFromBackupObject(obj) {
    const opened = unsealBackupFile(obj);
    if (opened.error) {
      alert(opened.error);
      return false;
    }
    fieldsHydrated = false;
    applySavedState(opened.payload);
    fieldsHydrated = true;
    renderAll(entries);
    const result = saveProgress();
    if (result && result.scormOk && result.verified) {
      alert("Backup restored and saved to Canvas.");
    } else if (result && result.scormOk) {
      alert("Backup restored. Use Save & Exit so Canvas can finish storing it.");
    } else {
      alert(
        "Backup restored on this screen.\n\nCanvas did not confirm the save yet — keep your backup file, and click Save until the top bar says “Canvas save OK”."
      );
    }
    return true;
  }

  function handleBackupFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(String(reader.result || ""));
        restoreFromBackupObject(obj);
      } catch (e) {
        alert("Could not read that backup file. Make sure it is a .json file from Save & Exit.");
      }
    };
    reader.readAsText(file);
  }

  function saveAndExit() {
    const result = saveProgress();
    const downloaded = downloadBackupFile();
    if (!downloaded) {
      alert(
        "Could not download the backup file in this window.\n\nIf your browser blocked it, allow downloads for this site, then click Save & Exit again."
      );
    }

    if (!ScormAPI.isAvailable()) {
      alert(
        "Offline mode: " +
          (downloaded ? "a backup file was downloaded. " : "") +
          "You can close this window."
      );
      try {
        window.close();
      } catch {
        // no-op
      }
      return;
    }

    if (!result || !result.scormOk) {
      alert(
        "Canvas did not confirm your save.\n\n" +
          (downloaded
            ? "A backup file was still downloaded — keep it.\n\n"
            : "A backup file may not have downloaded. Try Save & Exit again after allowing downloads.\n\n") +
          "Do not leave yet. Click Save until the top bar says “Canvas save OK”, then Save & Exit.\n\n" +
          "If progress is lost later, use Restore Backup with your .json file."
      );
      return;
    }

    ScormAPI.commit();
    ScormAPI.finish();

    try {
      window.close();
    } catch {
      // no-op
    }
    setTimeout(() => {
      if (document.visibilityState === "hidden") return;
      alert("Progress saved. You can close this window or return to Canvas.");
    }, 400);
  }

  function renderAll(nextEntries) {
    if (nextEntries && nextEntries !== entries) entries = nextEntries;
    renderItems(entries);
    updateHeaderAndScorm(entries);
  }

  function init() {
    const btnSave = document.getElementById("btnSave");
    const btnSaveExit = document.getElementById("btnSaveExit");
    const btnRestoreBackup = document.getElementById("btnRestoreBackup");
    const backupFileInput = document.getElementById("backupFileInput");
    const btnExport = document.getElementById("btnExport");

    ScormAPI.initialize();

    const saved = ScormAPI.loadSuspendData();
    applySavedState(saved);
    fieldsHydrated = true;
    renderAll(entries);
    updateLmsSaveStatus(null);

    btnSave.addEventListener("click", () => {
      const result = saveProgress();
      if (result && result.scormOk && result.verified) {
        // ok
      } else if (result && result.scormOk) {
        alert("Save sent to Canvas. Use Save & Exit so Canvas can finish storing it.");
      } else if (result && result.tooLarge) {
        alert("Your portfolio is too large for this LMS to store. Shorten long typed entries, then try Save again. Use Save & Exit to keep a backup file.");
      } else if (!ScormAPI.isAvailable()) {
        alert("Not connected to Canvas. Use Save & Exit to download a backup file.");
      } else {
        alert("Canvas save failed. Try again, or use Save & Exit to download a backup.");
      }
    });

    btnSaveExit.addEventListener("click", () => saveAndExit());

    btnRestoreBackup.addEventListener("click", () => {
      if (backupFileInput) backupFileInput.click();
    });
    if (backupFileInput) {
      backupFileInput.addEventListener("change", () => {
        const file = backupFileInput.files && backupFileInput.files[0];
        handleBackupFile(file);
        backupFileInput.value = "";
      });
    }

    btnExport.addEventListener("click", async () => {
      const date = new Date().toISOString().slice(0, 10);
      const zipName = `sos-leadership-portfolio-export-${date}.zip`;
      const zip = new JSZip();
      const sanitized = sanitizeEntriesForPersist(entries);

      const exportPayload = {
        exportedAt: nowIso(),
        settings: { personalChoiceRequired: PERSONAL_CHOICE_REQUIRED },
        entries: sanitized,
      };

      // Explicit paths (not nested folder() only) so unzippers always show both folders.
      zip.file(
        "Organized/README.txt",
        "Organized export — one file per portfolio item (plus entries.json).\n" +
          "For Canvas, use the file inside the Canvas Submission folder instead.\n"
      );
      zip.file("Organized/entries.json", JSON.stringify(exportPayload, null, 2));

      for (const item of ITEMS) {
        const e = sanitized[item.id] || {};
        const content = exportTextForItem(item, e);
        const base = safeFileName(`${item.title}`.replace(/\s+/g, " ").trim());
        zip.file(
          `Organized/${base}.txt`,
          (content && content.trim().length ? content : "(no entry)") + "\n"
        );
      }

      zip.file(
        "Canvas Submission/README.txt",
        "Submit SOS-Leadership-Portfolio-Canvas-Submission.txt to the Canvas assignment labeled:\n" +
          "Leadership Philosophy Portfolio Assessment\n"
      );
      zip.file(
        "Canvas Submission/SOS-Leadership-Portfolio-Canvas-Submission.txt",
        buildCombinedExportText(sanitized)
      );

      const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = zipName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });

    window.setInterval(() => {
      try {
        if (fieldsHydrated) saveProgress();
      } catch {
        // no-op
      }
    }, 45000);

    window.addEventListener("beforeunload", () => {
      try {
        if (fieldsHydrated) {
          const result = ScormAPI.saveSuspendData(buildProgressPayload());
          const completion = computeCompletion(entries, { personalChoiceRequired: PERSONAL_CHOICE_REQUIRED });
          syncCompletionToLms(completion);
          // Do not Terminate here — that is Save & Exit only.
          if (result && result.scormOk) ScormAPI.commit();
        }
      } catch {
        // no-op
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
