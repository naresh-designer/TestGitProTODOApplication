// Persistent keys keep tasks and project names available after a refresh.
const storageKey = "daymark-tasks";
const projectKey = "daymark-projects";

const defaultProjects = ["Personal", "Work", "Ideas"];
const starterTasks = [
  { id: 1, title: "Review the week's priorities", project: "Work", priority: "high", completed: false, due: "Today" },
  { id: 2, title: "Book a little time to think", project: "Personal", priority: "medium", completed: false, due: "Today" },
  { id: 3, title: "Capture three ideas for the new project", project: "Ideas", priority: "low", completed: true, due: "Today" }
];

// View state is intentionally small so rendering stays predictable.
let tasks = readStorage(storageKey, starterTasks);
let projects = readStorage(projectKey, defaultProjects);
let currentView = "today";
let currentFilter = "all";
let sortAscending = false;

const $ = (selector) => document.querySelector(selector);
const taskList = $("#taskList");
const emptyState = $("#emptyState");
const taskInput = $("#taskInput");
const projectSelect = $("#projectSelect");
const prioritySelect = $("#prioritySelect");

// Fall back gracefully when localStorage is empty or contains invalid JSON.
function readStorage(key, fallback) {
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    return saved || fallback;
  } catch {
    return fallback;
  }
}

function save() {
  localStorage.setItem(storageKey, JSON.stringify(tasks));
  localStorage.setItem(projectKey, JSON.stringify(projects));
}

function formatDate(date) {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(date);
}

function renderDates() {
  const date = new Date();
  $("#topbarDate").textContent = formatDate(date);
  $("#sidebarDate").textContent = `${date.getFullYear()} / ${String(date.getMonth() + 1).padStart(2, "0")} / ${String(date.getDate()).padStart(2, "0")}`;
}

function renderProjects() {
  $("#projectList").innerHTML = projects.map((project) => `<button class="project-item" type="button" data-project="${escapeHtml(project)}"><span class="project-dot"></span>${escapeHtml(project)}</button>`).join("");
  projectSelect.innerHTML = projects.map((project) => `<option value="${escapeHtml(project)}">${escapeHtml(project)}</option>`).join("");
}

function visibleTasks() {
  let result = tasks.filter((task) => {
    if (currentView === "completed") return task.completed;
    if (currentView === "upcoming") return !task.completed;
    return true;
  });
  if (currentFilter === "high") result = result.filter((task) => task.priority === "high");
  if (currentFilter === "today") result = result.filter((task) => task.due === "Today");
  return result.sort((a, b) => {
    const priority = { high: 3, medium: 2, low: 1 };
    return sortAscending ? priority[a.priority] - priority[b.priority] : priority[b.priority] - priority[a.priority];
  });
}

// Render only the tasks allowed by the active view and filter.
function renderTasks() {
  const visible = visibleTasks();
  taskList.innerHTML = visible.map((task) => `
    <article class="task-item ${task.completed ? "completed" : ""}" data-id="${task.id}">
      <button class="check-button" type="button" data-action="toggle" aria-label="${task.completed ? "Mark incomplete" : "Mark complete"}">${task.completed ? "✓" : ""}</button>
      <div class="task-copy"><p class="task-name">${escapeHtml(task.title)}</p><div class="task-meta"><span class="priority ${task.priority}">${task.priority}</span><span>${escapeHtml(task.project)}</span><span>${task.due}</span></div></div>
      <div class="task-actions"><button class="task-action" type="button" data-action="delete" aria-label="Delete task">×</button></div>
    </article>`).join("");
  emptyState.hidden = visible.length > 0;
  $("#taskTotal").textContent = `${visible.length} task${visible.length === 1 ? "" : "s"}`;
  updateCounts();
}

// Counts and the progress ring always reflect the complete task collection.
function updateCounts() {
  const openTasks = tasks.filter((task) => !task.completed);
  const completedTasks = tasks.filter((task) => task.completed).length;
  const percent = tasks.length ? Math.round((completedTasks / tasks.length) * 100) : 0;
  $("#allCount").textContent = tasks.length;
  $("#importantCount").textContent = tasks.filter((task) => task.priority === "high").length;
  $("#filterTodayCount").textContent = tasks.filter((task) => task.due === "Today").length;
  $("#todayCount").textContent = openTasks.length;
  $("#progressValue").textContent = `${percent}%`;
  $("#progressRing").style.background = `conic-gradient(var(--green) ${percent * 3.6}deg, var(--paper-deep) 0deg)`;
  $("#progressRing").setAttribute("aria-label", `${percent} percent complete`);
}

function renderView() {
  const titles = { today: ["Your personal command center", "Good morning, Naresh.", "A small list is a kind list. What matters most today?", "Today's focus"], upcoming: ["A little ahead of yourself", "Upcoming.", "Keep the next few steps close, without letting them crowd today.", "On the horizon"], completed: ["A quiet record of progress", "Completed.", "Look at what moved because you showed up.", "Finished work"] };
  const [kicker, title, subtitle, section] = titles[currentView];
  $("#viewKicker").textContent = kicker;
  $("#viewTitle").innerHTML = `${title.replace(".", "<span class=\"title-dot\">.</span>")}`;
  $("#viewSubtitle").textContent = subtitle;
  $("#taskSectionTitle").textContent = section;
  document.querySelectorAll(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.view === currentView));
  renderTasks();
}

function addTask() {
  const title = taskInput.value.trim();
  if (!title) { showToast("Write the task first"); taskInput.focus(); return; }
  tasks.unshift({ id: Date.now(), title, project: projectSelect.value, priority: prioritySelect.value, completed: false, due: "Today" });
  taskInput.value = "";
  save();
  renderTasks();
  showToast("Task added to your day");
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2200);
}

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" }[character]));
}

// Event delegation keeps dynamically rendered task buttons working.
taskList.addEventListener("click", (event) => {
  const action = event.target.closest("[data-action]");
  if (!action) return;
  const item = action.closest(".task-item");
  const task = tasks.find((entry) => entry.id === Number(item.dataset.id));
  if (action.dataset.action === "toggle") task.completed = !task.completed;
  if (action.dataset.action === "delete") tasks = tasks.filter((entry) => entry.id !== task.id);
  save();
  renderTasks();
});

$("#addTaskButton").addEventListener("click", addTask);
taskInput.addEventListener("keydown", (event) => { if (event.key === "Enter") addTask(); });
document.querySelectorAll(".nav-item").forEach((button) => button.addEventListener("click", () => { currentView = button.dataset.view; currentFilter = "all"; renderView(); }));
document.querySelectorAll(".filter-tab").forEach((button) => button.addEventListener("click", () => { currentFilter = button.dataset.filter; document.querySelectorAll(".filter-tab").forEach((tab) => tab.classList.toggle("active", tab === button)); renderTasks(); }));
$("#sortButton").addEventListener("click", () => { sortAscending = !sortAscending; $("#sortButton").innerHTML = `Sort: ${sortAscending ? "low priority" : "priority"} <span>⌄</span>`; renderTasks(); });
$("#clearCompletedButton").addEventListener("click", () => { tasks = tasks.filter((task) => !task.completed); save(); renderTasks(); showToast("Completed tasks cleared"); });
$("#addProjectButton").addEventListener("click", () => { const project = prompt("Name your new project"); if (project && project.trim() && !projects.includes(project.trim())) { projects.push(project.trim()); save(); renderProjects(); showToast("Project added"); } });
$("#themeButton").addEventListener("click", () => { document.body.classList.toggle("sunny-mode"); showToast("Theme adjusted"); });

document.addEventListener("click", (event) => { const projectButton = event.target.closest("[data-project]"); if (projectButton) { currentView = "today"; currentFilter = "all"; projectSelect.value = projectButton.dataset.project; renderView(); tasks = tasks.filter((task) => task.project === projectButton.dataset.project || task.completed); renderTasks(); } });

renderDates();
renderProjects();
renderView();
