import { AUTO_REFRESH_INTERVAL_MS, GOOGLE_SHEET_CSV_URL } from "./config.mjs";
import { createSlotsSignature, loadSlotsFromSheet } from "./sheet-source.mjs";
import { sampleSlots } from "./storage.mjs";
import { addDays, getMondayOfWeek, getSlotsForWeek, getWeekDays, getWeekDaysWithSlots } from "./schedule.mjs";

const scheduleRoot = document.querySelector("#schedule-root");
let currentSignature = "";

initializeStudentPage();
window.setInterval(refreshScheduleIfChanged, AUTO_REFRESH_INTERVAL_MS);

async function initializeStudentPage() {
  const { slots, message, updatedAt } = await loadScheduleSlots();
  currentSignature = createSlotsSignature(slots);
  const todayText = formatDate(new Date());
  const thisMonday = getMondayOfWeek(todayText);
  const nextMonday = formatDate(addDays(parseDate(thisMonday), 7));

  renderSchedule([
    { label: "本週", startDate: thisMonday },
    { label: "下一週", startDate: nextMonday },
  ], slots, message, updatedAt);
}

async function refreshScheduleIfChanged() {
  const { slots, message, updatedAt } = await loadScheduleSlots();
  const nextSignature = createSlotsSignature(slots);
  if (nextSignature === currentSignature) {
    renderLastUpdated(updatedAt);
    return;
  }

  currentSignature = nextSignature;
  const todayText = formatDate(new Date());
  const thisMonday = getMondayOfWeek(todayText);
  const nextMonday = formatDate(addDays(parseDate(thisMonday), 7));
  renderSchedule([
    { label: "本週", startDate: thisMonday },
    { label: "下一週", startDate: nextMonday },
  ], slots, message, updatedAt);
}

async function loadScheduleSlots() {
  try {
    const slots = await loadSlotsFromSheet(GOOGLE_SHEET_CSV_URL);
    return {
      slots,
      message: GOOGLE_SHEET_CSV_URL ? "" : "目前尚未設定 Google Sheet，畫面使用本機範例資料。",
      updatedAt: new Date(),
    };
  } catch (error) {
    return {
      slots: sampleSlots,
      message: "Google Sheet 資料讀取失敗，畫面暫時使用本機範例資料。",
      updatedAt: new Date(),
    };
  }
}

function renderSchedule(weeks, slots, message, updatedAt) {
  scheduleRoot.innerHTML = `
    ${message ? `<p class="data-notice">${message}</p>` : ""}
    <p class="last-updated" id="last-updated">${formatUpdatedAt(updatedAt)}</p>
    ${weeks.map((week) => renderWeek(week.label, week.startDate, slots)).join("")}
  `;
}

function renderLastUpdated(updatedAt) {
  const lastUpdated = document.querySelector("#last-updated");
  if (lastUpdated) {
    lastUpdated.textContent = formatUpdatedAt(updatedAt);
  }
}

function renderWeek(label, startDate, slots) {
  const weekRangeDays = getWeekDays(startDate);
  const days = getWeekDaysWithSlots(slots, startDate);
  const weekSlots = getSlotsForWeek(slots, startDate);
  const endDate = weekRangeDays.at(-1).date;

  return `
    <section class="week-section" aria-labelledby="week-${startDate}">
      <div class="week-heading">
        <div>
          <p class="eyebrow">${label}</p>
          <h3 id="week-${startDate}">${formatDateRange(startDate, endDate)}</h3>
        </div>
      </div>
      <div class="week-list">
        ${days.length > 0 ? days.map((day) => renderDay(day, weekSlots)).join("") : `<p class="helper-text">目前沒有可詢問時段。</p>`}
      </div>
    </section>
  `;
}

function renderDay(day, weekSlots) {
  const daySlots = weekSlots.filter((slot) => slot.date === day.date);
  const statusText = daySlots.length > 0 ? `${daySlots.length} 個時段` : "暫無開放";

  return `
    <article class="day-card ${daySlots.length === 0 ? "muted-day" : ""}">
      <header>
        <strong class="day-title">${formatShortDate(day.date)} <span>${day.weekday}</span></strong>
        <small>${statusText}</small>
      </header>
      ${daySlots.map(renderSlot).join("")}
    </article>
  `;
}

function renderSlot(slot) {
  return `
    <div class="slot-card">
      <time>${slot.startTime} - ${slot.endTime}</time>
      <div class="group-split">
        ${renderGroup("義式組", slot.espresso, "espresso-row")}
        ${renderGroup("感官手沖組", slot.brew, "brew-row")}
      </div>
    </div>
  `;
}

function renderGroup(label, group, className) {
  return `
    <div class="group-row ${className}">
      <span>${label}</span>
      <strong>${getGroupStatusText(group)}</strong>
    </div>
  `;
}

function getGroupStatusText(group) {
  if (group.status === "closed") {
    return "不開放";
  }

  if (group.status === "hidden" || !group.showCapacity) {
    return "不顯示名額";
  }

  return `可詢問名額 ${group.capacity}`;
}

function formatDateRange(startDate, endDate) {
  return `${formatShortDate(startDate)} - ${formatShortDate(endDate)}`;
}

function formatShortDate(dateText) {
  const [, month, day] = dateText.split("-");
  return `${Number(month)}/${Number(day)}`;
}

function parseDate(dateText) {
  const [year, month, day] = dateText.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatUpdatedAt(date) {
  return `最後更新：${date.toLocaleString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}
