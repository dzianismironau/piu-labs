// ====== Prosty Kanban bez bibliotek ======

// Ключи storage
const STORAGE_KEY = "kanban_board_v1";
const ID_SEQ_KEY  = "kanban_id_seq";

// Безопасный localStorage
function lsGet(key, fallback=null){ try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } }
function lsSet(key, val){ try { localStorage.setItem(key, val); } catch {} }

// Узлы колонок
const app = document.getElementById("app");
const columns = {
  todo: document.querySelector('[data-col="todo"] .column__cards'),
  inprogress: document.querySelector('[data-col="inprogress"] .column__cards'),
  done: document.querySelector('[data-col="done"] .column__cards')
};

// Порядок колонок
const columnOrder = ["todo", "inprogress", "done"];

// ====== Инициализация (скрипт подключён с defer) ======
init();
function init(){
  try {
    wireColumnButtons();
    loadBoard();
    refreshUI();
    setupDnD();
  } catch (e) {
    console.error("Błąd inicjalizacji:", e);
  }
}

// ====== Утилиты ======
function nextId() {
  let n = parseInt(lsGet(ID_SEQ_KEY, "1"), 10);
  lsSet(ID_SEQ_KEY, String(n + 1));
  return `c${n}`;
}

function randColor() {
  const h = Math.floor(Math.random() * 360);
  const s = 70 + Math.floor(Math.random() * 20);
  const l = 85 + Math.floor(Math.random() * 8);
  return `hsl(${h} ${s}% ${l}%)`;
}

function createCardDOM({ id, content, color }, columnName) {
  const tpl = document.getElementById("card-template");
  const node = tpl.content.firstElementChild.cloneNode(true);
  node.dataset.id = id;
  node.style.background = color || randColor();

  const contentEl = node.querySelector('[data-role="content"]');
  contentEl.textContent = content || "Nowa karta";
  contentEl.addEventListener("input", debounce(() => {
    saveBoard();
  }, 250));

  refreshArrows(node, columnName);
  return node;
}

// ГАРАНТИРОВАННО: в центре две стрелки
function refreshArrows(cardEl, columnName) {
  const left  = cardEl.querySelector('[data-card-action="left"]');
  const right = cardEl.querySelector('[data-card-action="right"]');
  if (!left || !right) return;

  if (!columnName) {
    const col = cardEl.closest('.column')?.dataset.col;
    columnName = col || 'todo';
  }
  const idx = columnOrder.indexOf(columnName);

  if (idx === 0) { // левая колонка
    left.style.display  = "none";
    right.style.display = "inline-block";
  } else if (idx === columnOrder.length - 1) { // правая колонка
    left.style.display  = "inline-block";
    right.style.display = "none";
  } else { // центральная колонка
    left.style.display  = "inline-block";
    right.style.display = "inline-block";
  }
}

function updateCounterFor(columnSectionEl){
  const section = columnSectionEl.closest(".column");
  const counter = section?.querySelector("[data-counter]");
  if (counter) counter.textContent = columnSectionEl.querySelectorAll(".card").length;
}
function updateAllCounters(){
  Object.values(columns).forEach(updateCounterFor);
}

function refreshUI(){
  for (const name of columnOrder){
    const listEl = columns[name];
    listEl.querySelectorAll(".card").forEach(card => refreshArrows(card, name));
  }
  updateAllCounters();
}

function debounce(fn, wait){
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(null, args), wait);
  };
}

// ====== Делегирование кликов по колонкам ======
function wireColumnButtons(){
  document.querySelectorAll(".column").forEach((section) => {
    const dropzone = section.querySelector("[data-dropzone]");

    section.addEventListener("click", (e) => {
      try {
        const target = e.target;

        // 1) Добавить карточку
        if (target.matches('[data-action="add"]')) {
          const id = nextId();
          const card = createCardDOM({ id, content: "Nowa karta", color: randColor() }, section.dataset.col);
          dropzone.prepend(card);
          saveBoard();
          refreshUI();
          return;
        }

        // 2) Покрасить все карточки колонки
        if (target.matches('[data-action="paint"]')) {
          const col = randColor();
          dropzone.querySelectorAll(".card").forEach(card => {
            card.style.background = col;
          });
          saveBoard();
          refreshUI();
          return;
        }

        // 3) Клик по карточке мимо текста — смена цвета одной карточки
        const card = target.closest(".card");
        if (card) {
          const isInsideEditable = target.closest('[data-role="content"]') != null;
          const isButton = target.closest("button") != null;
          if (!isInsideEditable && !isButton) {
            card.style.background = randColor();
            saveBoard();
            return;
          }
        }

        // 4) Действия карточек: delete / left / right
        if (target.matches("[data-card-action]")) {
          const action = target.getAttribute("data-card-action");
          const cardEl = target.closest(".card");
          const currentCol = section.dataset.col;

          if (action === "delete") {
            cardEl.remove();
            saveBoard();
            refreshUI();
            return;
          }

          if (action === "left" || action === "right") {
            const dir = action === "left" ? -1 : 1;
            const colIndex = columnOrder.indexOf(currentCol);
            const nextIndex = Math.min(columnOrder.length - 1, Math.max(0, colIndex + dir));
            if (nextIndex !== colIndex) {
              const nextColName = columnOrder[nextIndex];
              const nextColEl = columns[nextColName];
              nextColEl.prepend(cardEl);
              refreshUI(); // пересчёт стрелок и счётчиков
              saveBoard();
            }
            return;
          }
        }
      } catch (err) {
        console.error("Błąd kliknięcia:", err);
      }
    });

    // Изменение текста — сохранить
    section.addEventListener("input", (e) => {
      if (e.target.matches('[data-role="content"]')) {
        saveBoard();
      }
    });
  });
}

// ====== Drag & Drop (сортировка в колонке) ======
let draggedCard = null;

function setupDnD(){
  Object.values(columns).forEach((dropzone) => {
    dropzone.addEventListener("dragstart", (e) => {
      const card = e.target.closest(".card");
      if (!card) return;
      draggedCard = card;
      e.dataTransfer.effectAllowed = "move";
      setTimeout(() => card.classList.add("dragging"), 0);
    });

    dropzone.addEventListener("dragend", () => {
      if (draggedCard){
        draggedCard.classList.remove("dragging");
        draggedCard = null;
        saveBoard();
        refreshUI();
      }
    });

    dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      const after = getAfterElement(dropzone, e.clientY);
      if (!draggedCard) return;
      if (after == null) {
        dropzone.appendChild(draggedCard);
      } else {
        dropzone.insertBefore(draggedCard, after);
      }
    });

    dropzone.addEventListener("drop", () => {
      refreshUI();
      saveBoard();
    });
  });
}

function getAfterElement(container, y){
  const elements = [...container.querySelectorAll(".card:not(.dragging)")];
  return elements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - (box.top + box.height / 2);
    if (offset < 0 && offset > closest.offset){
      return { offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY, element: null }).element;
}

// ====== Сохранение/загрузка ======
function saveBoard(){
  const state = { columns: {} };
  for (const name of columnOrder){
    const listEl = columns[name];
    const items = [...listEl.querySelectorAll(".card")].map(card => ({
      id: card.dataset.id,
      content: card.querySelector('[data-role="content"]').textContent.trim(),
      color: card.style.background || randColor()
    }));
    state.columns[name] = items;
  }
  lsSet(STORAGE_KEY, JSON.stringify(state));
}

function loadBoard(){
  const raw = lsGet(STORAGE_KEY);
  if (!raw) return;
  try{
    const state = JSON.parse(raw);
    for (const name of columnOrder){
      const listEl = columns[name];
      listEl.innerHTML = "";
      (state.columns?.[name] || []).forEach(item => {
        const card = createCardDOM(item, name);
        listEl.appendChild(card);
        refreshArrows(card, name);
      });
    }
  }catch(e){
    console.warn("Nie udało się odczytać zapisanej tablicy:", e);
  }
}
