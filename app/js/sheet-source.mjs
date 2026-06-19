import { sampleSlots } from "./storage.mjs";

export async function loadSlotsFromSheet(csvUrl) {
  if (!csvUrl) {
    return sampleSlots;
  }

  const response = await fetch(csvUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Google Sheet 資料讀取失敗");
  }

  const csvText = await response.text();
  const rows = parseCsv(csvText);
  return rowsToSlots(rows);
}

export function parseCsv(csvText) {
  const rows = [];
  let row = [];
  let value = "";
  let insideQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const character = csvText[index];
    const nextCharacter = csvText[index + 1];

    if (character === '"' && nextCharacter === '"') {
      value += '"';
      index += 1;
      continue;
    }

    if (character === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (character === "," && !insideQuotes) {
      row.push(value.trim());
      value = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !insideQuotes) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }
      row.push(value.trim());
      if (row.some((cell) => cell !== "")) {
        rows.push(row);
      }
      row = [];
      value = "";
      continue;
    }

    value += character;
  }

  row.push(value.trim());
  if (row.some((cell) => cell !== "")) {
    rows.push(row);
  }

  return rows;
}

export function rowsToSlots(rows) {
  if (rows.length < 2) {
    return [];
  }

  const headers = rows[0];
  return rows.slice(1).map((row, index) => {
    const record = Object.fromEntries(headers.map((header, cellIndex) => [header, row[cellIndex] || ""]));
    const date = normalizeSheetDate(record["日期"]);
    return {
      id: `sheet-${date}-${record["開始時間"]}-${index}`,
      date,
      startTime: record["開始時間"],
      endTime: record["結束時間"],
      espresso: createGroup(record["義式組狀態"], record["義式組名額"]),
      brew: createGroup(record["感官手沖組狀態"], record["感官手沖組名額"]),
    };
  }).filter((slot) => slot.date && slot.startTime && slot.endTime);
}

export function createSlotsSignature(slots) {
  return JSON.stringify(
    slots
      .map((slot) => ({
        date: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        espresso: slot.espresso,
        brew: slot.brew,
      }))
      .toSorted((left, right) => {
        const leftKey = `${left.date}-${left.startTime}-${left.endTime}`;
        const rightKey = `${right.date}-${right.startTime}-${right.endTime}`;
        return leftKey.localeCompare(rightKey);
      }),
  );
}

function createGroup(statusText, capacityText) {
  const status = normalizeStatus(statusText);
  return {
    status,
    capacity: Number(capacityText || 0),
    showCapacity: status === "open",
  };
}

function normalizeSheetDate(dateText) {
  const normalized = String(dateText || "").trim();
  const parts = normalized.split(/[/-]/).map((part) => part.trim());

  if (parts.length === 2) {
    const [month, day] = parts;
    return formatDateParts(new Date().getFullYear(), month, day) || normalized;
  }

  if (parts.length === 3) {
    const [year, month, day] = parts;
    return formatDateParts(year, month, day) || normalized;
  }

  return normalized;
}

function formatDateParts(year, month, day) {
  const yearNumber = Number(year);
  const monthNumber = Number(month);
  const dayNumber = Number(day);

  if (!yearNumber || !monthNumber || !dayNumber || monthNumber > 12 || dayNumber > 31) {
    return "";
  }

  return [
    String(yearNumber).padStart(4, "0"),
    String(monthNumber).padStart(2, "0"),
    String(dayNumber).padStart(2, "0"),
  ].join("-");
}

function normalizeStatus(statusText) {
  const normalized = String(statusText || "").trim();
  if (["不開放", "closed", "close"].includes(normalized)) {
    return "closed";
  }
  if (["不顯示名額", "hidden", "hide"].includes(normalized)) {
    return "hidden";
  }
  return "open";
}
