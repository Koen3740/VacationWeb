import { toIsoDate } from '../departure-period-popup/departure-period-popup-utils';

export type Traveller = {
  id: string;
  dateOfBirth: string | null;
};

export type TravelersState = {
  travellers: Traveller[];
  roomCount: number;
  roomAssignments: number[];
};

/** Legacy homepage occupancy (adults/children/babies per room). Used only to read old session/UI state. */
export type RoomTravelers = {
  adults: number;
  children: number;
  babies: number;
};

/** Existing homepage cap — do not raise without a product decision. */
export const MAX_TOTAL_TRAVELERS = 9;
export const MIN_TOTAL_TRAVELERS = 1;

export const TRAVELERS_LIMITS = {
  adults: { min: 1, max: 12, default: 2 },
  children: { min: 0, max: 8, default: 0 },
  babies: { min: 0, max: 8, default: 0 },
} as const;

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function isValidIsoDateOfBirth(iso: string, today: Date = new Date()): boolean {
  const match = ISO_DATE_PATTERN.exec(iso);
  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return false;
  }

  return parsed.getTime() <= startOfLocalDay(today).getTime();
}

export function calendarDateFromParts(
  year: number,
  month: number,
  day: number,
  today: Date = new Date(),
): string | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  const iso = toIsoDate(parsed);
  return isValidIsoDateOfBirth(iso, today) ? iso : null;
}

/** Display-only age. Not stored and not a provider category. */
export function derivedAgeYears(iso: string, today: Date = new Date()): number | null {
  if (!isValidIsoDateOfBirth(iso, today)) {
    return null;
  }

  const [year, month, day] = iso.split('-').map(Number);
  const birth = new Date(year, month - 1, day);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDelta = today.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

function nextTravellerId(existing: Traveller[]): string {
  const max = existing.reduce((highest, traveller) => {
    const match = /^t-(\d+)$/.exec(traveller.id);
    const value = match ? Number(match[1]) : 0;
    return Math.max(highest, value);
  }, 0);
  return `t-${max + 1}`;
}

function createTraveller(existing: Traveller[] = []): Traveller {
  return {
    id: nextTravellerId(existing),
    dateOfBirth: null,
  };
}

function clampRoomCount(roomCount: number, travellerCount: number): number {
  const maxRooms = Math.max(MIN_TOTAL_TRAVELERS, Math.min(MAX_TOTAL_TRAVELERS, travellerCount));
  return Math.min(maxRooms, Math.max(MIN_TOTAL_TRAVELERS, Math.floor(roomCount)));
}

function normalizeAssignments(
  assignments: number[],
  travellerCount: number,
  roomCount: number,
): number[] {
  const next = Array.from({ length: travellerCount }, (_, index) => {
    const value = assignments[index];
    if (!Number.isInteger(value) || value < 0 || value >= roomCount) {
      return 0;
    }
    return value;
  });

  if (roomCount <= 1) {
    return next.map(() => 0);
  }

  return next;
}

export function createDefaultTravelersState(): TravelersState {
  return {
    travellers: [
      { id: 't-1', dateOfBirth: null },
      { id: 't-2', dateOfBirth: null },
    ],
    roomCount: 1,
    roomAssignments: [0, 0],
  };
}

function migrateLegacyRooms(rooms: RoomTravelers[]): TravelersState {
  const people: Traveller[] = [];
  for (const room of rooms) {
    const count = Math.max(
      0,
      Math.floor(room.adults) + Math.floor(room.children) + Math.floor(room.babies),
    );
    for (let index = 0; index < count; index += 1) {
      if (people.length >= MAX_TOTAL_TRAVELERS) {
        break;
      }
      people.push(createTraveller(people));
    }
  }

  const travellers = people.length > 0 ? people : createDefaultTravelersState().travellers;
  const roomCount = clampRoomCount(Math.max(1, rooms.length), travellers.length);

  return {
    travellers,
    roomCount,
    roomAssignments: normalizeAssignments([], travellers.length, roomCount),
  };
}

export function normalizeTravelersState(raw: unknown): TravelersState {
  if (!raw || typeof raw !== 'object') {
    return createDefaultTravelersState();
  }

  const record = raw as Partial<TravelersState> & { rooms?: RoomTravelers[] };

  if (Array.isArray(record.travellers)) {
    const travellers = record.travellers
      .map((item, index) => {
        const id = typeof item?.id === 'string' && item.id.trim() !== '' ? item.id : `t-${index + 1}`;
        const dateOfBirth =
          typeof item?.dateOfBirth === 'string' && isValidIsoDateOfBirth(item.dateOfBirth)
            ? item.dateOfBirth
            : null;
        return { id, dateOfBirth };
      })
      .slice(0, MAX_TOTAL_TRAVELERS);

    const normalizedTravellers =
      travellers.length >= MIN_TOTAL_TRAVELERS ? travellers : createDefaultTravelersState().travellers;
    const roomCount = clampRoomCount(
      typeof record.roomCount === 'number' ? record.roomCount : 1,
      normalizedTravellers.length,
    );

    return {
      travellers: normalizedTravellers,
      roomCount,
      roomAssignments: normalizeAssignments(
        Array.isArray(record.roomAssignments) ? record.roomAssignments : [],
        normalizedTravellers.length,
        roomCount,
      ),
    };
  }

  if (Array.isArray(record.rooms) && record.rooms.length > 0) {
    return migrateLegacyRooms(record.rooms);
  }

  return createDefaultTravelersState();
}

export function getTotalTravelers(state: TravelersState): number {
  return normalizeTravelersState(state).travellers.length;
}

export function getTravelersTotals(state: TravelersState | RoomTravelers[]) {
  if (Array.isArray(state)) {
    const migrated = migrateLegacyRooms(state);
    return {
      adults: migrated.travellers.length,
      children: 0,
      babies: 0,
    };
  }

  return {
    adults: getTotalTravelers(state),
    children: 0,
    babies: 0,
  };
}

export function formatTravelersLabel(state: TravelersState | RoomTravelers[]): string {
  const total = Array.isArray(state)
    ? migrateLegacyRooms(state).travellers.length
    : getTotalTravelers(state);

  if (total === 0) {
    return 'Reisgezelschap';
  }

  return total === 1 ? '1 persoon' : `${total} personen`;
}

export function formatRoomsLabel(state: TravelersState): string {
  const roomCount = normalizeTravelersState(state).roomCount;
  return roomCount === 1 ? '1 kamer' : `${roomCount} kamers`;
}

export function canIncreaseTravelers(state: TravelersState): boolean {
  return getTotalTravelers(state) < MAX_TOTAL_TRAVELERS;
}

export function canDecreaseTravelers(state: TravelersState): boolean {
  return getTotalTravelers(state) > MIN_TOTAL_TRAVELERS;
}

export function canIncreaseRooms(state: TravelersState): boolean {
  const normalized = normalizeTravelersState(state);
  return normalized.roomCount < normalized.travellers.length;
}

export function canDecreaseRooms(state: TravelersState): boolean {
  return normalizeTravelersState(state).roomCount > 1;
}

export function setTravellerCount(state: TravelersState, count: number): TravelersState {
  const normalized = normalizeTravelersState(state);
  const nextCount = Math.min(
    MAX_TOTAL_TRAVELERS,
    Math.max(MIN_TOTAL_TRAVELERS, Math.floor(count)),
  );
  let travellers = normalized.travellers.slice(0, nextCount);
  const assignments = normalized.roomAssignments.slice(0, nextCount);

  while (travellers.length < nextCount) {
    const traveller = createTraveller(travellers);
    travellers = [...travellers, traveller];
    assignments.push(0);
  }

  const roomCount = clampRoomCount(normalized.roomCount, travellers.length);

  return {
    travellers,
    roomCount,
    roomAssignments: normalizeAssignments(assignments, travellers.length, roomCount),
  };
}

export function addTraveller(state: TravelersState): TravelersState {
  if (!canIncreaseTravelers(state)) {
    return normalizeTravelersState(state);
  }
  return setTravellerCount(state, getTotalTravelers(state) + 1);
}

export function removeTraveller(state: TravelersState, index: number): TravelersState {
  const normalized = normalizeTravelersState(state);
  if (normalized.travellers.length <= MIN_TOTAL_TRAVELERS || index < 0 || index >= normalized.travellers.length) {
    return normalized;
  }

  const travellers = normalized.travellers.filter((_, current) => current !== index);
  const assignments = normalized.roomAssignments.filter((_, current) => current !== index);
  const roomCount = clampRoomCount(normalized.roomCount, travellers.length);

  return {
    travellers,
    roomCount,
    roomAssignments: normalizeAssignments(assignments, travellers.length, roomCount),
  };
}

export function setTravellerDateOfBirth(
  state: TravelersState,
  index: number,
  dateOfBirth: string | null,
): TravelersState {
  const normalized = normalizeTravelersState(state);
  const traveller = normalized.travellers[index];
  if (!traveller) {
    return normalized;
  }

  const nextDob = dateOfBirth && isValidIsoDateOfBirth(dateOfBirth) ? dateOfBirth : null;

  return {
    ...normalized,
    travellers: normalized.travellers.map((item, current) =>
      current === index ? { ...item, dateOfBirth: nextDob } : item,
    ),
  };
}

export function setRoomCount(state: TravelersState, roomCount: number): TravelersState {
  const normalized = normalizeTravelersState(state);
  const nextRoomCount = clampRoomCount(roomCount, normalized.travellers.length);

  return {
    ...normalized,
    roomCount: nextRoomCount,
    roomAssignments: normalizeAssignments(
      normalized.roomAssignments,
      normalized.travellers.length,
      nextRoomCount,
    ),
  };
}

export function assignTravellerRoom(
  state: TravelersState,
  travellerIndex: number,
  roomIndex: number,
): TravelersState {
  const normalized = normalizeTravelersState(state);
  if (
    travellerIndex < 0 ||
    travellerIndex >= normalized.travellers.length ||
    roomIndex < 0 ||
    roomIndex >= normalized.roomCount
  ) {
    return normalized;
  }

  const roomAssignments = [...normalized.roomAssignments];
  roomAssignments[travellerIndex] = roomIndex;

  return { ...normalized, roomAssignments };
}

export function travellersInRoom(state: TravelersState, roomIndex: number): Traveller[] {
  const normalized = normalizeTravelersState(state);
  return normalized.travellers.filter((_, index) => normalized.roomAssignments[index] === roomIndex);
}

export type PartyTraveller = {
  dateOfBirth: string | null;
  roomIndex: number;
};

export function serializeTravelersToQuery(state: TravelersState): {
  dob: string;
  partyRooms?: string;
  adults: string;
  rooms?: string;
} {
  const normalized = normalizeTravelersState(state);
  const dob = normalized.travellers.map((traveller) => traveller.dateOfBirth ?? '').join(',');
  const result: { dob: string; partyRooms?: string; adults: string; rooms?: string } = {
    dob,
    adults: String(normalized.travellers.length),
  };

  if (normalized.roomCount > 1) {
    result.rooms = String(normalized.roomCount);
    result.partyRooms = normalized.roomAssignments.map((index) => String(index + 1)).join(',');
  }

  return result;
}

export function parseTravelersFromQuery(input: {
  dob?: string;
  partyRooms?: string;
  adults?: string;
  children?: string;
  babies?: string;
  rooms?: string;
}): TravelersState | null {
  if (typeof input.dob === 'string') {
    const tokens = input.dob.split(',');
    const travellers: Traveller[] = [];
    for (const token of tokens) {
      if (travellers.length >= MAX_TOTAL_TRAVELERS) {
        break;
      }
      const trimmed = token.trim();
      travellers.push({
        id: `t-${travellers.length + 1}`,
        dateOfBirth: trimmed && isValidIsoDateOfBirth(trimmed) ? trimmed : null,
      });
    }

    if (travellers.length < MIN_TOTAL_TRAVELERS) {
      return createDefaultTravelersState();
    }

    const parsedRooms = typeof input.partyRooms === 'string'
      ? input.partyRooms.split(',').map((value) => Number(value.trim()) - 1)
      : [];
    const roomsFromAssignments = parsedRooms.reduce((highest, value) => {
      if (!Number.isInteger(value) || value < 0) {
        return highest;
      }
      return Math.max(highest, value + 1);
    }, 1);
    const requestedRooms = Number(input.rooms);
    const roomCount = clampRoomCount(
      Math.max(
        Number.isFinite(requestedRooms) && requestedRooms > 0 ? requestedRooms : 1,
        roomsFromAssignments,
      ),
      travellers.length,
    );

    return {
      travellers,
      roomCount,
      roomAssignments: normalizeAssignments(parsedRooms, travellers.length, roomCount),
    };
  }

  const adults = Number(input.adults);
  const children = Number(input.children);
  const babies = Number(input.babies);
  const rooms = Number(input.rooms);
  const hasLegacy =
    (Number.isFinite(adults) && adults > 0) ||
    (Number.isFinite(children) && children > 0) ||
    (Number.isFinite(babies) && babies > 0) ||
    (Number.isFinite(rooms) && rooms > 0);

  if (!hasLegacy) {
    return null;
  }

  const migrated = migrateLegacyRooms([
    {
      adults: Number.isFinite(adults) && adults > 0 ? adults : TRAVELERS_LIMITS.adults.default,
      children: Number.isFinite(children) && children > 0 ? children : 0,
      babies: Number.isFinite(babies) && babies > 0 ? babies : 0,
    },
  ]);
  const roomCount = clampRoomCount(Number.isFinite(rooms) && rooms > 0 ? rooms : 1, migrated.travellers.length);

  return {
    ...migrated,
    roomCount,
    roomAssignments: normalizeAssignments([], migrated.travellers.length, roomCount),
  };
}

export function travelersStateToParty(state: TravelersState): PartyTraveller[] {
  const normalized = normalizeTravelersState(state);
  return normalized.travellers.map((traveller, index) => ({
    dateOfBirth: traveller.dateOfBirth,
    roomIndex: normalized.roomAssignments[index] ?? 0,
  }));
}

export function partyHasStoredCategory(value: unknown): boolean {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.travellers)) {
    return false;
  }

  return record.travellers.some((traveller) => {
    if (!traveller || typeof traveller !== 'object') {
      return false;
    }
    const item = traveller as Record<string, unknown>;
    return 'category' in item || 'ageBand' in item || 'ageCategory' in item;
  });
}
