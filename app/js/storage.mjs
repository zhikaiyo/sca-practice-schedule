export const STORAGE_KEY = "sca-practice-schedule-slots";

export const sampleSlots = [
  {
    id: "sample-2026-06-17-1000",
    date: "2026-06-17",
    startTime: "10:00",
    endTime: "12:00",
    espresso: { status: "open", capacity: 3, showCapacity: true },
    brew: { status: "open", capacity: 2, showCapacity: true },
  },
  {
    id: "sample-2026-06-17-1400",
    date: "2026-06-17",
    startTime: "14:00",
    endTime: "16:00",
    espresso: { status: "closed", capacity: 0, showCapacity: false },
    brew: { status: "open", capacity: 4, showCapacity: true },
  },
  {
    id: "sample-2026-06-18-1330",
    date: "2026-06-18",
    startTime: "13:30",
    endTime: "15:30",
    espresso: { status: "open", capacity: 2, showCapacity: true },
    brew: { status: "closed", capacity: 0, showCapacity: false },
  },
  {
    id: "sample-2026-06-22-1900",
    date: "2026-06-22",
    startTime: "19:00",
    endTime: "21:00",
    espresso: { status: "hidden", capacity: 0, showCapacity: false },
    brew: { status: "open", capacity: 2, showCapacity: true },
  },
];

export function loadSlots(storage = window.localStorage) {
  const rawValue = storage.getItem(STORAGE_KEY);
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSlots(slots, storage = window.localStorage) {
  storage.setItem(STORAGE_KEY, JSON.stringify(slots));
}

export function ensureSeedData(storage = window.localStorage) {
  const existingSlots = loadSlots(storage);
  if (existingSlots.length > 0) {
    return existingSlots;
  }

  saveSlots(sampleSlots, storage);
  return sampleSlots;
}
