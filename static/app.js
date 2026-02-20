let loadToken = 0;
let currentFilter = "all"; 
let currentSort = "newest";
let currentPage = 1;
const ITEMS_PER_PAGE = 10;


async function reloadWithoutJump() {
  const y = window.scrollY;
  await loadItems();
  window.scrollTo(0, y);
}

function paintActiveFilter() {
  const all = document.getElementById("filterAll");
  const lost = document.getElementById("filterLost");
  const found = document.getElementById("filterFound");
  if (!all || !lost || !found) return;

  all.classList.toggle("active", currentFilter === "all");
  lost.classList.toggle("active", currentFilter === "lost");
  found.classList.toggle("active", currentFilter === "found");
}

function setMsg(text, type = "") {
  const el = document.getElementById("msg");
  el.textContent = text || "";
  el.className = "msg " + (type || "");
}

function matchesSearch(item, q) {
  if (!q) return true;
  q = q.toLowerCase();

  const title = (item.title || "").toLowerCase();
  const location = (item.location || "").toLowerCase();
  const desc = (item.description || "").toLowerCase();

  return title.includes(q) || location.includes(q) || desc.includes(q);
}


async function checkApi() {
  const badge = document.getElementById("statusBadge");
  try {
    const res = await fetch("/items");
    badge.textContent = res.ok ? "API: online" : "API: issue";
  } catch {
    badge.textContent = "API: offline";
  }
}

async function loadItems() {
  const myToken = ++loadToken;

  const list = document.getElementById("itemsList");
  list.innerHTML = "";

  let res, data;
  try {
    res = await fetch("/items");
    data = await res.json();
  } catch {
    if (myToken !== loadToken) return;
    list.innerHTML =
      `<div class="item"><div class="itemTitle">Error</div><div class="itemMeta">Network error</div></div>`;
    return;
  }

  if (myToken !== loadToken) return;

  if (!res.ok) {
    list.innerHTML =
      `<div class="item"><div class="itemTitle">Error</div><div class="itemMeta">${data.error || "Unknown error"}</div></div>`;
    return;
  }

  const q = document.getElementById("searchInput")?.value.trim() || "";

  // 1) Filter by search
  let items = (data.items || []).filter(it => matchesSearch(it, q));

  // 2) Filter by status tab
  if (currentFilter !== "all") {
    items = items.filter(it => (it.status || "lost") === currentFilter);
  }

  // 3) Sort
  if (currentSort === "newest") {
    items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  } else if (currentSort === "oldest") {
    items.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  } else if (currentSort === "az") {
    items.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  }

  // 4) Pagination calc (always at least 1 page)
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));

  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  const end = start + ITEMS_PER_PAGE;
  const pageItems = items.slice(start, end);

  // Page info + disable buttons
  const pageInfo = document.getElementById("pageInfo");
  if (pageInfo) pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;

  const prevBtn = document.getElementById("prevPage");
  const nextBtn = document.getElementById("nextPage");
  if (prevBtn) prevBtn.disabled = (currentPage === 1);
  if (nextBtn) nextBtn.disabled = (currentPage === totalPages);

  // Empty state
  if (pageItems.length === 0) {
    list.innerHTML =
      `<div class="item"><div class="itemTitle">No items found</div><div class="itemMeta">Try changing filters/search or add a new item.</div></div>`;
    return;
  }

  // 5) Render items
  for (const item of pageItems) {
    const card = document.createElement("div");
    card.className = "item";

    const when = item.created_at
      ? new Date(item.created_at).toLocaleString() + " (local)"
      : "unknown time";

    const top = document.createElement("div");
    top.className = "itemTop";

    const left = document.createElement("div");

    const status = item.status || "lost";
    const badgeClass = status === "found"
      ? "badge-status badge-found"
      : "badge-status badge-lost";
    const badgeText = status === "found" ? "FOUND" : "LOST";

    left.innerHTML = `
      <div class="itemTitle">${item.title}</div>
      <div class="itemMeta">
        #${item.id} • ${item.location || "Location not set"} • ${when}
        &nbsp; <span class="${badgeClass}">${badgeText}</span>
      </div>
    `;

    const actions = document.createElement("div");
    actions.className = "itemActions";

    // EDIT
    const editBtn = document.createElement("button");
    editBtn.className = "btn secondary";
    editBtn.type = "button";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", async () => {
      const newTitle = prompt("New title:", item.title) ?? item.title;
      if (!newTitle.trim()) {
        alert("Title cannot be empty");
        return;
      }
      const newDesc = prompt("New description:", item.description || "") ?? (item.description || "");
      const newLoc = prompt("New location:", item.location || "") ?? (item.location || "");

      const updateRes = await fetch(`/update-item/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDesc.trim(),
          location: newLoc.trim()
        })
      });

      const updateData = await updateRes.json().catch(() => ({}));
      if (!updateRes.ok) {
        alert(`Update failed: ${updateData.error || "Unknown error"}`);
        return;
      }
      await loadItems();
    });

    // TOGGLE FOUND/LOST
    const toggleBtn = document.createElement("button");
    toggleBtn.className = "btn secondary";
    toggleBtn.type = "button";
    toggleBtn.textContent = (status === "found") ? "Mark Lost" : "Mark Found";

    toggleBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      toggleBtn.disabled = true;
      const originalText = toggleBtn.textContent;
      toggleBtn.textContent = "Saving...";

      const newStatus = (status === "found") ? "lost" : "found";

      try {
        const updateRes = await fetch(`/update-item/${item.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify({ status: newStatus })
        });

        const updateData = await updateRes.json().catch(() => ({}));

        if (!updateRes.ok) {
          alert(`Update failed: ${updateData.error || "Unknown error"}`);
          toggleBtn.disabled = false;
          toggleBtn.textContent = originalText;
          return;
        }

        // keep scroll position stable
        await reloadWithoutJump();
      } catch (err) {
        console.error(err);
        alert("Update failed. Check console.");
        toggleBtn.disabled = false;
        toggleBtn.textContent = originalText;
      }
    });

    // DELETE
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn danger";
    deleteBtn.type = "button";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", async () => {
      const ok = confirm(`Delete item #${item.id}?`);
      if (!ok) return;

      const delRes = await fetch(`/delete-item/${item.id}`, { method: "DELETE" });
      const delData = await delRes.json().catch(() => ({}));
      if (!delRes.ok) {
        alert(`Delete failed: ${delData.error || "Unknown error"}`);
        return;
      }
      await loadItems();
    });

    actions.appendChild(editBtn);
    actions.appendChild(toggleBtn);
    actions.appendChild(deleteBtn);

    top.appendChild(left);
    top.appendChild(actions);

    const meta = document.createElement("div");
    meta.className = "itemMeta";
    meta.textContent = item.description ? item.description : "No description";

    card.appendChild(top);
    card.appendChild(meta);

    list.appendChild(card);
  }
}

function debounce(fn, wait = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

function init() {
  document.getElementById("prevPage").onclick = () => {
  currentPage--;
  loadItems();
};

document.getElementById("nextPage").onclick = () => {
  currentPage++;
  loadItems();
};

  // Custom sort dropdown
const sortBtn = document.getElementById("sortBtn");
const sortMenu = document.getElementById("sortMenu");
const sortDropdown = document.getElementById("sortDropdown");

function sortLabel(val) {
  if (val === "oldest") return "Oldest first";
  if (val === "az") return "Title A–Z";
  return "Newest first";
}

function paintSortMenu() {
  if (!sortBtn || !sortMenu) return;
  sortBtn.childNodes[0].textContent = sortLabel(currentSort) + " ";
  sortMenu.querySelectorAll(".dropdown-item").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.sort === currentSort);
  });
}

if (sortBtn && sortMenu && sortDropdown) {
  sortBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    sortMenu.classList.toggle("open");
  });

sortMenu.querySelectorAll(".dropdown-item").forEach(btn => {
  btn.addEventListener("click", () => {
    currentSort = btn.dataset.sort;
    currentPage = 1;        // ✅ ADD
    paintSortMenu();
    sortMenu.classList.remove("open");
    loadItems();
  });
});


  // Close when clicking outside
  document.addEventListener("click", (e) => {
    if (!sortDropdown.contains(e.target)) {
      sortMenu.classList.remove("open");
    }
  });

  paintSortMenu();
}

  const sortSelect = document.getElementById("sortSelect");
if (sortSelect) {
  sortSelect.onchange = () => {
    currentSort = sortSelect.value;
    loadItems();
  };
}

  // Filter buttons (ONLY one set of handlers)
 document.getElementById("filterAll").onclick = () => {
  currentFilter = "all";
  currentPage = 1;          // ✅ ADD THIS
  paintActiveFilter();
  loadItems();
};


  document.getElementById("filterLost").onclick = () => {
  currentFilter = "lost";
  currentPage = 1;          // ✅ ADD
  paintActiveFilter();
  loadItems();
};

document.getElementById("filterFound").onclick = () => {
  currentFilter = "found";
  currentPage = 1;          // ✅ ADD
  paintActiveFilter();
  loadItems();
};


  // Refresh + Search
  document.getElementById("refreshBtn").addEventListener("click", loadItems);

  const search = document.getElementById("searchInput");
if (search) search.addEventListener("input", debounce(() => {
  currentPage = 1;          // ✅ ADD
  loadItems();
}, 250));


  // Add form
  document.getElementById("addForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    setMsg("Saving…");

    const title = document.getElementById("title").value.trim();
    const description = document.getElementById("description").value.trim();
    const location = document.getElementById("location").value.trim();

    const res = await fetch("/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, location })
    });

    const data = await res.json();

    if (!res.ok) {
      setMsg(`Error: ${data.error || "Failed"}`, "err");
      return;
    }

    setMsg(`Saved! New ID: ${data.id}`, "ok");
    document.getElementById("addForm").reset();
    await loadItems();
  });

  // Initial load (ONLY once)
  paintActiveFilter();
  checkApi();
  loadItems();
}

document.addEventListener("DOMContentLoaded", init);
