import { copyWeekToNextWeek, createSlotId, getMondayOfWeek, validateSlot } from "./schedule.mjs";
import { ensureSeedData, loadSlots, saveSlots } from "./storage.mjs";

const PASSWORD_KEY = "sca-practice-admin-password-hash";

const authPanel = document.querySelector("#auth-panel");
const authTitle = document.querySelector("#auth-title");
const authForm = document.querySelector("#auth-form");
const authMessage = document.querySelector("#auth-message");
const passwordInput = document.querySelector("#admin-password");
const adminApp = document.querySelector("#admin-app");
const slotForm = document.querySelector("#slot-form");
const slotMessage = document.querySelector("#slot-message");
const slotList = document.querySelector("#slot-list");
const listMessage = document.querySelector("#list-message");
const copyWeekButton = document.querySelector("#copy-week-button");

let slots = ensureSeedData();
let copyNeedsConfirmation = false;

initializeAuth();

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const password = passwordInput.value.trim();

  if (password.length < 6) {
    authMessage.textContent = "密碼至少需要 6 個字。";
    return;
  }

  const storedHash = localStorage.getItem(PASSWORD_KEY);
  const enteredHash = await hashPassword(password);

  if (!storedHash) {
    localStorage.setItem(PASSWORD_KEY, enteredHash);
    showAdminApp();
    return;
  }

  if (enteredHash !== storedHash) {
    authMessage.textContent = "密碼不正確。";
    return;
  }

  showAdminApp();
});

slotForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(slotForm);
  const slot = createSlotFromForm(formData);
  const errors = validateSlot(slot);

  if (errors.length > 0) {
    slotMessage.textContent = errors.join("、");
    return;
  }

  slots = [...slots, slot].toSorted(sortSlots);
  saveSlots(slots);
  slotForm.reset();
  slotMessage.textContent = "已新增時段。";
  renderSlotList();
});

copyWeekButton.addEventListener("click", () => {
  const todayText = getTodayText();
  const thisMonday = getMondayOfWeek(todayText);
  const nextWeekDates = new Set(copyWeekToNextWeek([{ date: thisMonday }], thisMonday).map((slot) => slot.date));
  const hasNextWeekData = slots.some((slot) => {
    const nextMonday = [...nextWeekDates][0];
    const nextWeekMonday = getMondayOfWeek(nextMonday);
    return getMondayOfWeek(slot.date) === nextWeekMonday;
  });

  if (hasNextWeekData && !copyNeedsConfirmation) {
    copyNeedsConfirmation = true;
    copyWeekButton.textContent = "再次點擊確認複製";
    listMessage.textContent = "下一週已經有資料。若仍要複製，請再點一次按鈕。";
    return;
  }

  const copiedSlots = copyWeekToNextWeek(slots, thisMonday);
  if (copiedSlots.length === 0) {
    listMessage.textContent = "本週沒有可複製的時段。";
    return;
  }

  slots = [...slots, ...copiedSlots].toSorted(sortSlots);
  saveSlots(slots);
  copyNeedsConfirmation = false;
  copyWeekButton.textContent = "複製本週到下一週";
  listMessage.textContent = `已複製 ${copiedSlots.length} 個時段到下一週。`;
  renderSlotList();
});

function initializeAuth() {
  if (localStorage.getItem(PASSWORD_KEY)) {
    authTitle.textContent = "輸入本機管理密碼";
  }
}

function showAdminApp() {
  authPanel.hidden = true;
  adminApp.hidden = false;
  renderSlotList();
}

function renderSlotList() {
  slots = loadSlots().toSorted(sortSlots);

  if (slots.length === 0) {
    slotList.innerHTML = `<p class="helper-text">目前沒有時段。</p>`;
    return;
  }

  slotList.innerHTML = slots.map(renderSlotEditor).join("");

  slotList.querySelectorAll("form").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      const updatedSlot = createSlotFromForm(formData, form.dataset.slotId);
      const errors = validateSlot(updatedSlot);

      if (errors.length > 0) {
        listMessage.textContent = errors.join("、");
        return;
      }

      slots = slots.map((slot) => (slot.id === updatedSlot.id ? updatedSlot : slot)).toSorted(sortSlots);
      saveSlots(slots);
      listMessage.textContent = "已更新時段。";
      renderSlotList();
    });
  });
}

function renderSlotEditor(slot) {
  return `
    <form class="slot-editor" data-slot-id="${slot.id}">
      <div class="slot-editor-header">
        <strong>${formatShortDate(slot.date)} ${slot.startTime} - ${slot.endTime}</strong>
        <button type="submit">儲存修改</button>
      </div>
      <div class="form-grid">
        <label>
          日期
          <input name="date" type="date" value="${slot.date}" required>
        </label>
        <label>
          開始時間
          <input name="startTime" type="time" value="${slot.startTime}" required>
        </label>
        <label>
          結束時間
          <input name="endTime" type="time" value="${slot.endTime}" required>
        </label>
      </div>
      ${renderGroupEditor("義式組", "espresso", slot.espresso)}
      ${renderGroupEditor("感官手沖組", "brew", slot.brew)}
    </form>
  `;
}

function renderGroupEditor(label, key, group) {
  return `
    <div class="group-editor compact">
      <h3>${label}</h3>
      <label>
        狀態
        <select name="${key}Status">
          ${renderStatusOptions(group.status)}
        </select>
      </label>
      <label>
        可詢問名額
        <input name="${key}Capacity" type="number" min="0" value="${group.capacity}">
      </label>
    </div>
  `;
}

function renderStatusOptions(selectedStatus) {
  const options = [
    ["open", "顯示可詢問名額"],
    ["hidden", "開放但不顯示名額"],
    ["closed", "不開放"],
  ];

  return options
    .map(([value, label]) => `<option value="${value}" ${value === selectedStatus ? "selected" : ""}>${label}</option>`)
    .join("");
}

function createSlotFromForm(formData, id = createSlotId()) {
  return {
    id,
    date: formData.get("date"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    espresso: createGroupFromForm(formData, "espresso"),
    brew: createGroupFromForm(formData, "brew"),
  };
}

function createGroupFromForm(formData, key) {
  const status = formData.get(`${key}Status`);
  return {
    status,
    capacity: Number(formData.get(`${key}Capacity`) || 0),
    showCapacity: status === "open",
  };
}

function sortSlots(left, right) {
  if (left.date !== right.date) {
    return left.date.localeCompare(right.date);
  }
  return left.startTime.localeCompare(right.startTime);
}

function getTodayText() {
  const today = new Date();
  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatShortDate(dateText) {
  const [, month, day] = dateText.split("-");
  return `${Number(month)}/${Number(day)}`;
}

async function hashPassword(password) {
  const data = new TextEncoder().encode(password);
  const buffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
