import test from "node:test";
import assert from "node:assert/strict";

import {
  copyWeekToNextWeek,
  getWeekDays,
  getMondayOfWeek,
  getSlotsForWeek,
  validateSlot,
} from "../js/schedule.mjs";
import {
  loadSlots,
  saveSlots,
} from "../js/storage.mjs";
import {
  createSlotsSignature,
  parseCsv,
  rowsToSlots,
} from "../js/sheet-source.mjs";

test("getMondayOfWeek returns Monday for a date in the same week", () => {
  assert.equal(getMondayOfWeek("2026-06-24"), "2026-06-22");
  assert.equal(getMondayOfWeek("2026-06-22"), "2026-06-22");
  assert.equal(getMondayOfWeek("2026-06-28"), "2026-06-22");
});

test("copyWeekToNextWeek copies only selected week and shifts dates by seven days", () => {
  const slots = [
    {
      id: "slot-1",
      date: "2026-06-22",
      startTime: "10:00",
      endTime: "12:00",
      espresso: { status: "open", capacity: 3, showCapacity: true },
      brew: { status: "open", capacity: 2, showCapacity: true },
    },
    {
      id: "slot-2",
      date: "2026-06-30",
      startTime: "14:00",
      endTime: "16:00",
      espresso: { status: "closed", capacity: 0, showCapacity: false },
      brew: { status: "open", capacity: 4, showCapacity: true },
    },
  ];

  const copied = copyWeekToNextWeek(slots, "2026-06-22");

  assert.equal(copied.length, 1);
  assert.equal(copied[0].date, "2026-06-29");
  assert.equal(copied[0].startTime, "10:00");
  assert.equal(copied[0].espresso.capacity, 3);
  assert.equal(copied[0].brew.capacity, 2);
  assert.notEqual(copied[0].id, "slot-1");
});

test("getWeekDays returns seven days from Monday to Sunday", () => {
  assert.deepEqual(getWeekDays("2026-06-24"), [
    { date: "2026-06-22", weekday: "星期一" },
    { date: "2026-06-23", weekday: "星期二" },
    { date: "2026-06-24", weekday: "星期三" },
    { date: "2026-06-25", weekday: "星期四" },
    { date: "2026-06-26", weekday: "星期五" },
    { date: "2026-06-27", weekday: "星期六" },
    { date: "2026-06-28", weekday: "星期日" },
  ]);
});

test("getSlotsForWeek returns sorted slots inside the selected week", () => {
  const slots = [
    { id: "next", date: "2026-06-29", startTime: "10:00", endTime: "12:00" },
    { id: "late", date: "2026-06-22", startTime: "14:00", endTime: "16:00" },
    { id: "early", date: "2026-06-22", startTime: "10:00", endTime: "12:00" },
  ];

  assert.deepEqual(
    getSlotsForWeek(slots, "2026-06-24").map((slot) => slot.id),
    ["early", "late"],
  );
});

test("validateSlot accepts a normal slot with independent group capacities", () => {
  const result = validateSlot({
    date: "2026-06-22",
    startTime: "10:00",
    endTime: "12:00",
    espresso: { status: "open", capacity: 3, showCapacity: true },
    brew: { status: "open", capacity: 2, showCapacity: true },
  });

  assert.deepEqual(result, []);
});

test("validateSlot rejects an end time that is not later than start time", () => {
  const result = validateSlot({
    date: "2026-06-22",
    startTime: "12:00",
    endTime: "10:00",
    espresso: { status: "open", capacity: 3, showCapacity: true },
    brew: { status: "closed", capacity: 0, showCapacity: false },
  });

  assert.deepEqual(result, ["結束時間必須晚於開始時間"]);
});

test("saveSlots and loadSlots persist schedule data through a storage object", () => {
  const storage = createMemoryStorage();
  const slots = [
    {
      id: "slot-1",
      date: "2026-06-22",
      startTime: "10:00",
      endTime: "12:00",
      espresso: { status: "open", capacity: 3, showCapacity: true },
      brew: { status: "open", capacity: 2, showCapacity: true },
    },
  ];

  saveSlots(slots, storage);

  assert.deepEqual(loadSlots(storage), slots);
}
);

test("rowsToSlots converts Google Sheet rows into schedule slots", () => {
  const csvText = [
    "日期,開始時間,結束時間,義式組狀態,義式組名額,感官手沖組狀態,感官手沖組名額",
    "2026-06-22,10:00,12:00,顯示名額,3,不開放,0",
    "2026-06-23,13:30,15:30,不顯示名額,0,顯示名額,2",
  ].join("\n");

  const slots = rowsToSlots(parseCsv(csvText));

  assert.equal(slots.length, 2);
  assert.equal(slots[0].date, "2026-06-22");
  assert.equal(slots[0].espresso.status, "open");
  assert.equal(slots[0].espresso.capacity, 3);
  assert.equal(slots[0].brew.status, "closed");
  assert.equal(slots[1].espresso.status, "hidden");
  assert.equal(slots[1].brew.capacity, 2);
});

test("createSlotsSignature changes when visible sheet data changes", () => {
  const baseSlots = rowsToSlots(parseCsv([
    "日期,開始時間,結束時間,義式組狀態,義式組名額,感官手沖組狀態,感官手沖組名額",
    "2026-06-22,10:00,12:00,顯示名額,3,顯示名額,2",
  ].join("\n")));
  const changedSlots = rowsToSlots(parseCsv([
    "日期,開始時間,結束時間,義式組狀態,義式組名額,感官手沖組狀態,感官手沖組名額",
    "2026-06-22,10:00,12:00,顯示名額,4,顯示名額,2",
  ].join("\n")));

  assert.equal(createSlotsSignature(baseSlots), createSlotsSignature(baseSlots));
  assert.notEqual(createSlotsSignature(baseSlots), createSlotsSignature(changedSlots));
});

function createMemoryStorage() {
  const data = new Map();
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, value);
    },
  };
}
