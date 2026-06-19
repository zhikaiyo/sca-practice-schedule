const DAY_MS = 24 * 60 * 60 * 1000;

export function getMondayOfWeek(dateText) {
  const date = parseLocalDate(dateText);
  const day = date.getDay();
  const distanceFromMonday = day === 0 ? 6 : day - 1;
  date.setDate(date.getDate() - distanceFromMonday);
  return formatLocalDate(date);
}

export function copyWeekToNextWeek(slots, weekStartDate) {
  const start = parseLocalDate(getMondayOfWeek(weekStartDate));
  const end = addDays(start, 6);

  return slots
    .filter((slot) => {
      const slotDate = parseLocalDate(slot.date);
      return slotDate >= start && slotDate <= end;
    })
    .map((slot) => ({
      ...structuredClone(slot),
      id: createSlotId(),
      date: formatLocalDate(addDays(parseLocalDate(slot.date), 7)),
    }));
}

export function getWeekDays(dateText) {
  const monday = parseLocalDate(getMondayOfWeek(dateText));
  const weekdayLabels = [
    "星期一",
    "星期二",
    "星期三",
    "星期四",
    "星期五",
    "星期六",
    "星期日",
  ];

  return weekdayLabels.map((weekday, index) => ({
    date: formatLocalDate(addDays(monday, index)),
    weekday,
  }));
}

export function getWeekDaysWithSlots(slots, dateText) {
  const datesWithSlots = new Set(getSlotsForWeek(slots, dateText).map((slot) => slot.date));
  return getWeekDays(dateText).filter((day) => datesWithSlots.has(day.date));
}

export function getSlotsForWeek(slots, dateText) {
  const weekDates = new Set(getWeekDays(dateText).map((day) => day.date));
  return slots
    .filter((slot) => weekDates.has(slot.date))
    .toSorted((left, right) => {
      if (left.date !== right.date) {
        return left.date.localeCompare(right.date);
      }
      return left.startTime.localeCompare(right.startTime);
    });
}

export function validateSlot(slot) {
  const errors = [];

  if (!slot.date) {
    errors.push("請選擇日期");
  }

  if (!slot.startTime) {
    errors.push("請填寫開始時間");
  }

  if (!slot.endTime) {
    errors.push("請填寫結束時間");
  }

  if (slot.startTime && slot.endTime && slot.endTime <= slot.startTime) {
    errors.push("結束時間必須晚於開始時間");
  }

  for (const groupKey of ["espresso", "brew"]) {
    const group = slot[groupKey];
    if (!group) {
      errors.push("課程組別資料不完整");
      continue;
    }

    if (!["open", "closed", "hidden"].includes(group.status)) {
      errors.push("課程組別狀態不正確");
    }

    if (group.capacity < 0) {
      errors.push("可詢問名額不可小於 0");
    }
  }

  return errors;
}

export function createSlotId() {
  return `slot-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function addDays(date, days) {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

function parseLocalDate(dateText) {
  const [year, month, day] = dateText.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
