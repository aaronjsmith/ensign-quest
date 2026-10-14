(function () {
  const kbRoot = document.getElementById("kb");
  const tocRoot = document.getElementById("toc");
  const searchInput = document.getElementById("kb-search");
  const emptyState = document.getElementById("kb-empty");
  let sections = window.ENSIGN_KB || [];

  if (!kbRoot || !tocRoot) return;

  function matchesQuery(text, query) {
    return text.toLowerCase().includes(query);
  }

  function entryMatches(entry, query) {
    if (!query) return true;
    return (
      matchesQuery(entry.name, query) ||
      matchesQuery(entry.host || "", query) ||
      matchesQuery(entry.blurb || "", query) ||
      matchesQuery(entry.github || "", query) ||
      matchesQuery(entry.reference?.label || "", query) ||
      matchesQuery(entry.reference?.url || "", query)
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
    const item = document.createElement("article");
    item.className = "kb-entry";

    const heading = document.createElement("h3");
    heading.className = "kb-entry__heading";

    const title = document.createElement("a");
    title.className = "kb-entry__title";
    title.href = entry.url;
    title.rel = "noopener noreferrer";
    title.textContent = entry.name;
    heading.appendChild(title);

    const meta = document.createElement("span");
    meta.className = "kb-entry__meta";
    meta.textContent = entry.host;

    item.append(heading, meta);

    if (entry.blurb) {
      const blurb = document.createElement("p");
      blurb.className = "kb-entry__blurb";
      blurb.textContent = entry.blurb;
      item.appendChild(blurb);
    }

    if (entry.github) {
      const github = document.createElement("p");
      github.className = "kb-entry__reference";
      github.append("Source: ");

      const githubLink = document.createElement("a");
      githubLink.href = entry.github;
      githubLink.rel = "noopener noreferrer";
      githubLink.target = "_blank";
      githubLink.textContent = "GitHub repository";
      github.appendChild(githubLink);
      item.appendChild(github);
    }

    if (entry.reference && entry.reference.url) {
      const reference = document.createElement("p");
      reference.className = "kb-entry__reference";
      reference.append("See also: ");

      const refLink = document.createElement("a");
      refLink.href = entry.reference.url;
      refLink.rel = "noopener noreferrer";
      refLink.target = "_blank";
      refLink.textContent =
        entry.reference.label || "Official Come Follow Me lesson";
      reference.appendChild(refLink);
      item.appendChild(reference);
    }

    return item;
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

  function mergeCloudflareProjects(projects) {
    const knownHosts = new Set(
      sections.flatMap((section) =>
        (section.entries || []).map((entry) => entry.host),
      ),
    );
    const newEntries = projects.filter(
      (project) => project.host && !knownHosts.has(project.host),
    );

    if (newEntries.length === 0) return;

    const dynamicSection = sections.find(
      (section) => section.id === "cloudflare-projects",
    );
    if (dynamicSection) {
      dynamicSection.entries.push(...newEntries);
    } else {
      sections = [
        ...sections,
        {
          id: "cloudflare-projects",
          name: "Cloudflare projects",
          summary: "Live project subdomains discovered from Cloudflare DNS.",
          entries: newEntries,
        },
      ];
    }

    render(searchInput?.value || "");
  }

  async function loadCloudflareProjects() {
    try {
      const response = await fetch("/api/projects", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) return;

      const payload = await response.json();
      if (Array.isArray(payload.projects)) {
        mergeCloudflareProjects(payload.projects);
      }
    } catch {
      // The curated project list remains available if DNS discovery is down.
    }
  }

  loadCloudflareProjects();
  window.setInterval(() => {
    loadCloudflareProjects();
  }, 5 * 60 * 1000);
})();
