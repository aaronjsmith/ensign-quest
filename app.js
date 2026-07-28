(function () {
  const list = document.getElementById("project-list");
  const projects = window.ENSIGN_PROJECTS || [];

  if (!list) return;

  if (projects.length === 0) {
    const empty = document.createElement("li");
    empty.className = "project-list__item";
    empty.textContent = "No projects listed yet.";
    list.appendChild(empty);
    return;
  }

  function createLink(project) {
    const link = document.createElement("a");
    link.className = "project-link";
    link.href = project.url;
    link.rel = "noopener noreferrer";

    const name = document.createElement("span");
    name.className = "project-link__name";
    name.textContent = project.name;

    const host = document.createElement("span");
    host.className = "project-link__host";
    host.textContent = project.host;

    link.append(name, host);

    if (project.blurb) {
      const blurb = document.createElement("p");
      blurb.className = "project-link__blurb";
      blurb.textContent = project.blurb;
      link.appendChild(blurb);
    }

    return link;
  }

  const fragment = document.createDocumentFragment();

  for (const project of projects) {
    const item = document.createElement("li");
    item.className = "project-list__item";

    if (project.children && project.children.length) {
      item.classList.add("project-list__item--section");

      const heading = document.createElement("h2");
      heading.className = "project-section__title";
      heading.textContent = project.name;
      item.appendChild(heading);

      if (project.blurb) {
        const blurb = document.createElement("p");
        blurb.className = "project-section__blurb";
        blurb.textContent = project.blurb;
        item.appendChild(blurb);
      }

      const children = document.createElement("ul");
      children.className = "project-list project-list--nested";

      for (const child of project.children) {
        const childItem = document.createElement("li");
        childItem.className = "project-list__item";
        childItem.appendChild(createLink(child));
        children.appendChild(childItem);
      }

      item.appendChild(children);
    } else {
      item.appendChild(createLink(project));
    }

    fragment.appendChild(item);
  }

  list.appendChild(fragment);
})();
