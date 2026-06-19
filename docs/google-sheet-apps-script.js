const SCHEDULE_SHEET_NAME = "工作表1";
const ARCHIVE_SHEET_NAME = "歷史資料";
const STATUS_OPTIONS = ["顯示名額", "不顯示名額", "不開放"];
const START_TIME_OPTIONS = ["8:30", "10:00", "13:00", "14:30"];
const END_TIME_OPTIONS = ["11:30", "16:00", "17:30"];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("練習時段工具")
    .addItem("套用時間下拉選單", "applyTimeDropdowns")
    .addItem("複製最新一週到下一週", "copyLatestWeekToNextWeek")
    .addItem("排序並檢查錯誤", "sortAndValidateSchedule")
    .addItem("封存過期時段", "archivePastSlots")
    .addToUi();
}

function onEdit(e) {
  if (!e || !e.range || e.range.getNumRows() > 1 || e.range.getNumColumns() > 1) return;

  const sheet = e.range.getSheet();
  if (sheet.getName() !== SCHEDULE_SHEET_NAME || e.range.getRow() === 1) return;

  const columns = getColumnMap_(sheet);
  const editedColumn = e.range.getColumn();

  if (editedColumn === columns.date) {
    const convertedDate = convertCompactDate_(e.value);
    if (convertedDate) {
      e.range.setValue(convertedDate);
      e.range.setNumberFormat("yyyy-mm-dd");
    }
  }

  if (editedColumn === columns.startTime || editedColumn === columns.endTime) {
    const convertedTime = convertCompactTime_(e.value);
    if (convertedTime) {
      e.range.setValue(convertedTime);
      e.range.setNumberFormat("h:mm");
    }

    updateTimeDropdownForCell_(e.range, editedColumn === columns.startTime ? START_TIME_OPTIONS : END_TIME_OPTIONS);
  }

  validateSchedule_();

  if ([columns.date, columns.startTime, columns.endTime].includes(editedColumn)) {
    sortSchedule_();
  }
}

function copyLatestWeekToNextWeek() {
  const sheet = getScheduleSheet_();
  const rows = getDataRows_(sheet);
  const datedRows = rows
    .map((row) => ({ row, date: parseDate_(row.values[0]) }))
    .filter((item) => item.date);

  if (datedRows.length === 0) {
    SpreadsheetApp.getUi().alert("目前沒有可複製的日期資料。");
    return;
  }

  const latestDate = datedRows.reduce((latest, item) => item.date > latest ? item.date : latest, datedRows[0].date);
  const sourceMonday = getMonday_(latestDate);
  const sourceSunday = addDays_(sourceMonday, 6);
  const targetMonday = addDays_(sourceMonday, 7);
  const targetSunday = addDays_(targetMonday, 6);

  const sourceRows = datedRows.filter((item) => item.date >= sourceMonday && item.date <= sourceSunday);
  const targetRows = datedRows.filter((item) => item.date >= targetMonday && item.date <= targetSunday);

  if (sourceRows.length === 0) {
    SpreadsheetApp.getUi().alert("找不到最新一週可複製的資料。");
    return;
  }

  if (targetRows.length > 0) {
    SpreadsheetApp.getUi().alert("下一週已經有資料，為了避免重複，這次沒有複製。");
    return;
  }

  const copiedRows = sourceRows.map((item) => {
    const copied = [...item.row.values];
    copied[0] = addDays_(item.date, 7);
    return copied;
  });

  const startRow = sheet.getLastRow() + 1;
  sheet.getRange(startRow, 1, copiedRows.length, copiedRows[0].length).setValues(copiedRows);
  formatDataRows_(sheet);
  sortSchedule_();
  validateSchedule_();

  SpreadsheetApp.getUi().alert(`已複製 ${copiedRows.length} 筆到下一週。`);
}

function sortAndValidateSchedule() {
  sortSchedule_();
  validateSchedule_();
  SpreadsheetApp.getUi().alert("已完成排序與錯誤檢查。");
}

function applyTimeDropdowns() {
  const sheet = getScheduleSheet_();
  const columns = getColumnMap_(sheet);

  if (!columns.startTime || !columns.endTime) {
    SpreadsheetApp.getUi().alert("找不到「開始時間」或「結束時間」欄位，請先確認表頭名稱。");
    return;
  }

  applyDropdownToColumn_(sheet, columns.startTime, START_TIME_OPTIONS);
  applyDropdownToColumn_(sheet, columns.endTime, END_TIME_OPTIONS);

  SpreadsheetApp.getUi().alert("已套用開始時間與結束時間下拉選單；特殊手動時間不會顯示無效警告。");
}

function archivePastSlots() {
  const ui = SpreadsheetApp.getUi();
  const confirm = ui.alert(
    "封存過期時段",
    "會把本週一以前的資料移到「歷史資料」分頁，原本工作表中的過期列會被移除。要繼續嗎？",
    ui.ButtonSet.OK_CANCEL
  );

  if (confirm !== ui.Button.OK) return;

  const sheet = getScheduleSheet_();
  const archiveSheet = getOrCreateArchiveSheet_(sheet);
  const rows = getDataRows_(sheet);
  const thisMonday = getMonday_(new Date());
  const expiredRows = rows.filter((row) => {
    const date = parseDate_(row.values[0]);
    return date && date < thisMonday;
  });

  if (expiredRows.length === 0) {
    ui.alert("目前沒有需要封存的過期時段。");
    return;
  }

  const archiveValues = expiredRows.map((row) => row.values);
  archiveSheet.getRange(archiveSheet.getLastRow() + 1, 1, archiveValues.length, archiveValues[0].length).setValues(archiveValues);

  expiredRows
    .map((row) => row.index)
    .sort((left, right) => right - left)
    .forEach((rowIndex) => sheet.deleteRow(rowIndex));

  formatDataRows_(sheet);
  formatDataRows_(archiveSheet);
  sortSchedule_();
  validateSchedule_();

  ui.alert(`已封存 ${expiredRows.length} 筆過期時段。`);
}

function sortSchedule_() {
  const sheet = getScheduleSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 2) return;

  sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn())
    .sort([
      { column: 1, ascending: true },
      { column: 2, ascending: true },
    ]);
}

function validateSchedule_() {
  const sheet = getScheduleSheet_();
  const rows = getDataRows_(sheet);
  if (rows.length === 0) return;

  const range = sheet.getRange(2, 1, rows.length, 7);
  range.setBackground(null);
  range.clearNote();

  rows.forEach((row) => {
    const values = row.values;
    if (values.every((value) => value === "")) return;

    const errors = [];
    const date = parseDate_(values[0]);
    const startMinutes = parseTimeToMinutes_(values[1]);
    const endMinutes = parseTimeToMinutes_(values[2]);

    if (!date) errors.push({ column: 1, message: "日期無法辨識" });
    if (startMinutes === null) errors.push({ column: 2, message: "開始時間無法辨識" });
    if (endMinutes === null) errors.push({ column: 3, message: "結束時間無法辨識" });
    if (startMinutes !== null && endMinutes !== null && endMinutes <= startMinutes) {
      errors.push({ column: 3, message: "結束時間必須晚於開始時間" });
    }

    validateGroup_(errors, values, 4, 5, "義式組");
    validateGroup_(errors, values, 6, 7, "感官手沖組");

    errors.forEach((error) => {
      sheet.getRange(row.index, error.column).setBackground("#fde8e4").setNote(error.message);
    });
  });
}

function validateGroup_(errors, values, statusColumn, capacityColumn, groupName) {
  const status = String(values[statusColumn - 1] || "").trim();
  const capacity = values[capacityColumn - 1];

  if (!STATUS_OPTIONS.includes(status)) {
    errors.push({ column: statusColumn, message: `${groupName} 狀態請使用下拉選單` });
  }

  if (status === "顯示名額") {
    const capacityNumber = Number(capacity);
    if (capacity === "" || Number.isNaN(capacityNumber) || capacityNumber < 0) {
      errors.push({ column: capacityColumn, message: `${groupName} 名額請填 0 以上數字` });
    }
  }
}

function getScheduleSheet_() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(SCHEDULE_SHEET_NAME);
  if (!sheet) throw new Error(`找不到分頁：${SCHEDULE_SHEET_NAME}`);
  return sheet;
}

function getOrCreateArchiveSheet_(sourceSheet) {
  const spreadsheet = SpreadsheetApp.getActive();
  let archiveSheet = spreadsheet.getSheetByName(ARCHIVE_SHEET_NAME);

  if (!archiveSheet) {
    archiveSheet = spreadsheet.insertSheet(ARCHIVE_SHEET_NAME);
    const headers = sourceSheet.getRange(1, 1, 1, sourceSheet.getLastColumn()).getValues();
    archiveSheet.getRange(1, 1, 1, headers[0].length).setValues(headers);
    archiveSheet.setFrozenRows(1);
  }

  return archiveSheet;
}

function getColumnMap_(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  return {
    date: headers.indexOf("日期") + 1,
    startTime: headers.indexOf("開始時間") + 1,
    endTime: headers.indexOf("結束時間") + 1,
  };
}

function getDataRows_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  return sheet.getRange(2, 1, lastRow - 1, 7).getValues().map((values, offset) => ({
    index: offset + 2,
    values,
  }));
}

function applyDropdownToColumn_(sheet, column, options) {
  const rowCount = sheet.getMaxRows() - 1;
  if (rowCount <= 0) return;

  const range = sheet.getRange(2, column, rowCount, 1);
  const values = range.getValues();
  const validations = values.map(([value]) => {
    const timeText = getTimeText_(value);
    return [timeText === "" || options.includes(timeText) ? createDropdownRule_(options) : null];
  });

  range.setDataValidations(validations);
}

function updateTimeDropdownForCell_(range, options) {
  const timeText = getTimeText_(range.getValue());

  if (timeText === "" || options.includes(timeText)) {
    range.setDataValidation(createDropdownRule_(options));
    return;
  }

  range.clearDataValidations();
}

function createDropdownRule_(options) {
  return SpreadsheetApp.newDataValidation()
    .requireValueInList(options, true)
    .setAllowInvalid(true)
    .build();
}

function getTimeText_(value) {
  if (value === "") return "";

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getHours()}:${String(value.getMinutes()).padStart(2, "0")}`;
  }

  if (typeof value === "number") {
    const totalMinutes = Math.round(value * 24 * 60);
    const hour = Math.floor(totalMinutes / 60) % 24;
    const minute = totalMinutes % 60;
    return `${hour}:${String(minute).padStart(2, "0")}`;
  }

  const text = String(value || "").trim();
  const compactTime = convertCompactTime_(text);
  if (compactTime) return `${compactTime.getHours()}:${String(compactTime.getMinutes()).padStart(2, "0")}`;

  return text;
}

function formatDataRows_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  sheet.getRange(2, 1, lastRow - 1, 1).setNumberFormat("yyyy-mm-dd");
  sheet.getRange(2, 2, lastRow - 1, 2).setNumberFormat("h:mm");
}

function convertCompactDate_(value) {
  const text = String(value || "").trim();
  if (!/^\d{3,4}$/.test(text)) return null;

  const month = Number(text.slice(0, -2));
  const day = Number(text.slice(-2));
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  return new Date(new Date().getFullYear(), month - 1, day);
}

function convertCompactTime_(value) {
  const text = String(value || "").trim();
  if (!/^\d{3,4}$/.test(text)) return null;

  const hour = Number(text.slice(0, -2));
  const minute = Number(text.slice(-2));
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  return new Date(1899, 11, 30, hour, minute, 0);
}

function parseDate_(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  const text = String(value || "").trim();
  const compactDate = convertCompactDate_(text);
  if (compactDate) return compactDate;

  const parts = text.split(/[/-]/).map((part) => Number(part.trim()));
  if (parts.length === 2) return buildDateIfValid_(new Date().getFullYear(), parts[0], parts[1]);
  if (parts.length === 3) return buildDateIfValid_(parts[0], parts[1], parts[2]);

  return null;
}

function buildDateIfValid_(year, month, day) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;

  return date;
}

function parseTimeToMinutes_(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.getHours() * 60 + value.getMinutes();
  }

  if (typeof value === "number") {
    return Math.round(value * 24 * 60);
  }

  const text = String(value || "").trim();
  const compactTime = convertCompactTime_(text);
  if (compactTime) return compactTime.getHours() * 60 + compactTime.getMinutes();

  const match = text.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  return hour * 60 + minute;
}

function getMonday_(date) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = result.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + offset);
  return result;
}

function addDays_(date, days) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  result.setDate(result.getDate() + days);
  return result;
}
