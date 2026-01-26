let loadToken = 0;
let currentFilter = "all"; 
function setMsg(text, type = "") {
  const el = document.getElementById("msg");
  el.textContent = text || "";
  el.className = "msg " + (type || "");
}

function matchesSearch(item, q) {
  if (!q) return true;
  q = q.toLowerCase();
  return (
    (item.title && item.title.toLowerCase().includes(q)) ||
    (item.location && item.location.toLowerCase().includes(q))
  );
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
  let items = (data.items || []).filter(it => matchesSearch(it, q));

if (currentFilter !== "all") {
  items = items.filter(it => (it.status || "lost") === currentFilter);
}


  if (items.length === 0) {
    list.innerHTML =
      `<div class="item"><div class="itemTitle">No items found</div><div class="itemMeta">Try adding a lost item on the left.</div></div>`;
    return;
  }

  for (const item of items) {
    const card = document.createElement("div");
    card.className = "item";

    const when = item.created_at
      ? new Date(item.created_at).toLocaleString() + " (local)"
      : "unknown time";

    const top = document.createElement("div");
    top.className = "itemTop";

    const left = document.createElement("div");
    left.innerHTML = `
      <div class="itemTitle">${item.title}</div>
      <div class="itemMeta">#${item.id} • ${item.location || "Location not set"} • ${when}</div>
    `;

    const actions = document.createElement("div");
    actions.className = "itemActions";

    const editBtn = document.createElement("button");
    editBtn.className = "btn secondary";
    editBtn.type = "button";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", async () => {
      const newTitle = prompt("New title:", item.title) ?? item.title;
      const newDesc = prompt("New description:", item.description || "") ?? (item.description || "");
      const newLoc = prompt("New location:", item.location || "") ?? (item.location || "");

    const updateRes = await fetch(`/update-item/${item.id}`, {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ status: newStatus })
});

      const updateData = await updateRes.json();
      if (!updateRes.ok) {
        alert(`Update failed: ${updateData.error || "Unknown error"}`);
        return;
      }
      await loadItems();
    });
// i add there
    const toggleBtn = document.createElement("button");
toggleBtn.className = "btn secondary";
toggleBtn.type = "button";
toggleBtn.textContent = (item.status === "found") ? "Mark Lost" : "Mark Found";

toggleBtn.addEventListener("click", async () => {
  console.log("Mark Found clicked for item:", item.id);

  const newStatus = (item.status === "found") ? "lost" : "found";
  console.log("Sending status:", newStatus);

  const url = `/update-item/${item.id}`;
  console.log("PUT URL:", url);

  try {
    const updateRes = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({ status: newStatus })
    });

    console.log("PUT response status:", updateRes.status);

    const text = await updateRes.text();
    console.log("PUT raw response:", text);

    let updateData = {};
    try { updateData = JSON.parse(text); } catch {}

    if (!updateRes.ok) {
      alert(`Update failed: ${updateData.error || "Unknown error"}`);
      return;
    }

    await loadItems();
  } catch (err) {
    console.error("PUT request failed:", err);
    alert("PUT request failed. Check console.");
  }
});


    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn danger";
    deleteBtn.type = "button";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", async () => {
      const ok = confirm(`Delete item #${item.id}?`);
      if (!ok) return;

      const delRes = await fetch(`/delete-item/${item.id}`, { method: "DELETE" });
      const delData = await delRes.json();
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

function init() {
    document.getElementById("filterAll").addEventListener("click", () => { currentFilter = "all"; loadItems(); });
document.getElementById("filterLost").addEventListener("click", () => { currentFilter = "lost"; loadItems(); });
document.getElementById("filterFound").addEventListener("click", () => { currentFilter = "found"; loadItems(); });

  document.getElementById("refreshBtn").addEventListener("click", loadItems);

  const search = document.getElementById("searchInput");
  if (search) search.addEventListener("input", loadItems);

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

  checkApi();
  loadItems();
}

document.addEventListener("DOMContentLoaded", init);
