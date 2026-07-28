(function () {
  const kbRoot = document.getElementById("kb");
  const tocRoot = document.getElementById("toc");
  const searchInput = document.getElementById("kb-search");
  const emptyState = document.getElementById("kb-empty");
  const sections = window.ENSIGN_KB || [];

  if (!kbRoot || !tocRoot) return;

  function matchesQuery(text, query) {
    return text.toLowerCase().includes(query);
  }

  function entryMatches(entry, query) {
    if (!query) return true;
    return (
      matchesQuery(entry.name, query) ||
      matchesQuery(entry.host || "", query) ||
      matchesQuery(entry.blurb || "", query)
    );
  }

  function sectionMatches(section, query) {
    if (!query) return true;
    if (matchesQuery(section.name, query) || matchesQuery(section.summary || "", query)) {
      return true;
    }
    return (section.entries || []).some((entry) => entryMatches(entry, query));
  }

  function createEntryLink(entry) {
    const link = document.createElement("a");
    link.className = "kb-entry";
    link.href = entry.url;
    link.rel = "noopener noreferrer";

    const title = document.createElement("span");
    title.className = "kb-entry__title";
    title.textContent = entry.name;

    const meta = document.createElement("span");
    meta.className = "kb-entry__meta";
    meta.textContent = entry.host;

    link.append(title, meta);

    if (entry.blurb) {
      const blurb = document.createElement("p");
      blurb.className = "kb-entry__blurb";
      blurb.textContent = entry.blurb;
      link.appendChild(blurb);
    }

    return link;
  }

  function render(query) {
    const q = (query || "").trim().toLowerCase();
    kbRoot.replaceChildren();
    tocRoot.replaceChildren();

    let visibleCount = 0;

    for (const section of sections) {
      if (!sectionMatches(section, q)) continue;

      const entries = (section.entries || []).filter((entry) => {
        if (!q) return true;
        if (matchesQuery(section.name, q) || matchesQuery(section.summary || "", q)) {
          return true;
        }
        return entryMatches(entry, q);
      });

      if (entries.length === 0) continue;
      visibleCount += entries.length;

      const tocLink = document.createElement("a");
      tocLink.className = "toc__link";
      tocLink.href = `#${section.id}`;
      tocLink.textContent = section.name;
      tocRoot.appendChild(tocLink);

      const article = document.createElement("section");
      article.className = "kb-section";
      article.id = section.id;

      const heading = document.createElement("h2");
      heading.className = "kb-section__title";
      heading.textContent = section.name;

      const summary = document.createElement("p");
      summary.className = "kb-section__summary";
      summary.textContent = section.summary || "";

      const list = document.createElement("ul");
      list.className = "kb-list";

      for (const entry of entries) {
        const item = document.createElement("li");
        item.className = "kb-list__item";
        item.appendChild(createEntryLink(entry));
        list.appendChild(item);
      }

      article.append(heading, summary, list);
      kbRoot.appendChild(article);
    }

    if (emptyState) {
      emptyState.hidden = visibleCount > 0;
    }
  }

  render("");

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      render(searchInput.value);
    });
  }
})();
