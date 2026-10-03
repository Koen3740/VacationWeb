import {
  CHILD_AGE_MAX,
  CHILD_AGE_MIN,
  DEFAULT_ADULTS,
  MAX_PARTY_TRAVELLERS,
  hasCompleteChildAges,
  isValidChildAge,
  legacyAgeFromIso,
  partyFromModel,
  readTravelerQuery,
  writeTravelerQuery,
  type PartyMember,
  type TravelerModel,
  type TravelerQueryInput,
} from '@/lib/search/traveler-contract';

/**
 * DEC-019 traveller state: adults are a count, children are an age (0-17 on the
 * calculated return date). `null` is a child whose age has not been chosen yet
 * (UI only; an incomplete party is never searched or put in a URL).
 * `roomAssignments` has one room per person: adults first, then children.
 */
export type TravelersState = {
  adults: number;
  childAges: Array<number | null>;
  roomCount: number;
  roomAssignments: number[];
};

/** Legacy homepage occupancy (adults/children/babies per room). Used only to read old session/UI state. */
export type RoomTravelers = {
  adults: number;
  children: number;
  babies: number;
};

/** Existing homepage cap - do not raise without a product decision. */
export const MAX_TOTAL_TRAVELERS = MAX_PARTY_TRAVELLERS;
export const MIN_TOTAL_TRAVELERS = 1;
export const MIN_ADULTS = 1;
export { CHILD_AGE_MAX, CHILD_AGE_MIN };

export const TRAVELERS_LIMITS = {
  adults: { min: 1, max: 12, default: 2 },
  children: { min: 0, max: 8, default: 0 },
  babies: { min: 0, max: 8, default: 0 },
} as const;

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

function buildState(
  adults: number,
  childAges: Array<number | null>,
  roomCountRaw: number,
  assignmentsRaw: number[],
): TravelersState {
  const safeAdults = Math.min(
    MAX_TOTAL_TRAVELERS,
    Math.max(MIN_ADULTS, Number.isFinite(adults) ? Math.floor(adults) : DEFAULT_ADULTS),
  );
  const safeChildren = childAges
    .slice(0, MAX_TOTAL_TRAVELERS - safeAdults)
    .map((age) => (isValidChildAge(age) ? age : null));
  const persons = safeAdults + safeChildren.length;
  const roomCount = clampRoomCount(Number.isFinite(roomCountRaw) ? roomCountRaw : 1, persons);
  return {
    adults: safeAdults,
    childAges: safeChildren,
    roomCount,
    roomAssignments: normalizeAssignments(assignmentsRaw, persons, roomCount),
  };
}

export function createDefaultTravelersState(): TravelersState {
  return {
    adults: DEFAULT_ADULTS,
    childAges: [],
    roomCount: 1,
    roomAssignments: [0, 0],
  };
}

function migrateLegacyRooms(rooms: RoomTravelers[]): TravelersState {
  let adults = 0;
  let children = 0;
  for (const room of rooms) {
    adults += Math.max(0, Math.floor(room.adults));
    children += Math.max(0, Math.floor(room.children)) + Math.max(0, Math.floor(room.babies));
  }
  if (adults < MIN_ADULTS) {
    return createDefaultTravelersState();
  }
  const childAges = Array.from({ length: children }, () => null as number | null);
  return buildState(adults, childAges, Math.max(1, rooms.length), []);
}

/** Old sessionStorage shape: travellers with a full date of birth. Converted to ages; DOBs are dropped. */
function migrateLegacyTravellers(
  travellers: unknown[],
  roomCount: number,
  roomAssignments: number[],
): TravelersState {
  const people = travellers.slice(0, MAX_TOTAL_TRAVELERS).map((item, index) => {
    const dob =
      item && typeof item === 'object' && typeof (item as { dateOfBirth?: unknown }).dateOfBirth === 'string'
        ? ((item as { dateOfBirth: string }).dateOfBirth)
        : '';
    const age = dob ? legacyAgeFromIso(dob) : null;
    const room = roomAssignments[index];
    return {
      age: age !== null && age < 18 ? age : null,
      room: Number.isInteger(room) && room >= 0 ? room : 0,
    };
  });
  if (people.length === 0) {
    return createDefaultTravelersState();
  }
  if (people.every((person) => person.age !== null)) {
    people[0] = { age: null, room: people[0].room };
  }
  const adultPeople = people.filter((person) => person.age === null);
  const childPeople = people.filter((person) => person.age !== null);
  return buildState(
    adultPeople.length,
    childPeople.map((person) => person.age),
    roomCount,
    [...adultPeople, ...childPeople].map((person) => person.room),
  );
}

export function normalizeTravelersState(raw: unknown): TravelersState {
  if (!raw || typeof raw !== 'object') {
    return createDefaultTravelersState();
  }

  const record = raw as Partial<TravelersState> & {
    rooms?: RoomTravelers[];
    travellers?: unknown[];
  };

  if (typeof record.adults === 'number' && Array.isArray(record.childAges)) {
    return buildState(
      record.adults,
      record.childAges as Array<number | null>,
      typeof record.roomCount === 'number' ? record.roomCount : 1,
      Array.isArray(record.roomAssignments) ? record.roomAssignments : [],
    );
  }

  if (Array.isArray(record.travellers)) {
    return migrateLegacyTravellers(
      record.travellers,
      typeof record.roomCount === 'number' ? record.roomCount : 1,
      Array.isArray(record.roomAssignments) ? record.roomAssignments : [],
    );
  }

  if (Array.isArray(record.rooms) && record.rooms.length > 0) {
    return migrateLegacyRooms(record.rooms);
  }

  return createDefaultTravelersState();
}

export function getTotalTravelers(state: TravelersState): number {
  const normalized = normalizeTravelersState(state);
  return normalized.adults + normalized.childAges.length;
}

export function getTravelersTotals(state: TravelersState | RoomTravelers[]) {
  const normalized = Array.isArray(state) ? migrateLegacyRooms(state) : normalizeTravelersState(state);
  let children = 0;
  let babies = 0;
  for (const age of normalized.childAges) {
    if (age !== null && age < 2) {
      babies += 1;
    } else {
      children += 1;
    }
  }
  return { adults: normalized.adults, children, babies };
}

export function formatTravelersLabel(state: TravelersState | RoomTravelers[]): string {
  const total = Array.isArray(state)
    ? migrateLegacyRooms(state).adults + migrateLegacyRooms(state).childAges.length
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

export function canDecreaseAdults(state: TravelersState): boolean {
  return normalizeTravelersState(state).adults > MIN_ADULTS;
}

export function canDecreaseChildren(state: TravelersState): boolean {
  return normalizeTravelersState(state).childAges.length > 0;
}

export function canIncreaseRooms(state: TravelersState): boolean {
  return normalizeTravelersState(state).roomCount < getTotalTravelers(state);
}

export function canDecreaseRooms(state: TravelersState): boolean {
  return normalizeTravelersState(state).roomCount > 1;
}

function withRoomLayout(
  adults: number,
  childAges: Array<number | null>,
  roomCount: number,
  assignments: number[],
): TravelersState {
  return buildState(adults, childAges, roomCount, assignments);
}

export function setAdultCount(state: TravelersState, count: number): TravelersState {
  const normalized = normalizeTravelersState(state);
  const maxAdults = MAX_TOTAL_TRAVELERS - normalized.childAges.length;
  const next = Math.min(maxAdults, Math.max(MIN_ADULTS, Math.floor(count)));
  const adultRooms = normalized.roomAssignments.slice(0, normalized.adults).slice(0, next);
  while (adultRooms.length < next) {
    adultRooms.push(0);
  }
  return withRoomLayout(
    next,
    normalized.childAges,
    normalized.roomCount,
    [...adultRooms, ...normalized.roomAssignments.slice(normalized.adults)],
  );
}

export function addChild(state: TravelersState): TravelersState {
  const normalized = normalizeTravelersState(state);
  if (!canIncreaseTravelers(normalized)) {
    return normalized;
  }
  return withRoomLayout(
    normalized.adults,
    [...normalized.childAges, null],
    normalized.roomCount,
    [...normalized.roomAssignments, 0],
  );
}

export function removeChild(state: TravelersState, index: number): TravelersState {
  const normalized = normalizeTravelersState(state);
  if (index < 0 || index >= normalized.childAges.length) {
    return normalized;
  }
  return withRoomLayout(
    normalized.adults,
    normalized.childAges.filter((_, current) => current !== index),
    normalized.roomCount,
    normalized.roomAssignments.filter((_, current) => current !== normalized.adults + index),
  );
}

export function setChildCount(state: TravelersState, count: number): TravelersState {
  const normalized = normalizeTravelersState(state);
  const maxChildren = MAX_TOTAL_TRAVELERS - normalized.adults;
  const next = Math.min(maxChildren, Math.max(0, Math.floor(count)));
  let current = normalized;
  while (current.childAges.length < next) {
    current = addChild(current);
  }
  while (current.childAges.length > next) {
    current = removeChild(current, current.childAges.length - 1);
  }
  return current;
}

export function setChildAge(
  state: TravelersState,
  index: number,
  age: number | null,
): TravelersState {
  const normalized = normalizeTravelersState(state);
  if (index < 0 || index >= normalized.childAges.length) {
    return normalized;
  }
  const nextAge = isValidChildAge(age) ? age : null;
  return {
    ...normalized,
    childAges: normalized.childAges.map((current, position) =>
      position === index ? nextAge : current,
    ),
  };
}

export function setRoomCount(state: TravelersState, roomCount: number): TravelersState {
  const normalized = normalizeTravelersState(state);
  const persons = getTotalTravelers(normalized);
  const nextRoomCount = clampRoomCount(roomCount, persons);

  return {
    ...normalized,
    roomCount: nextRoomCount,
    roomAssignments: normalizeAssignments(normalized.roomAssignments, persons, nextRoomCount),
  };
}

/** `personIndex`: adults first (0..adults-1), then children. */
export function assignTravellerRoom(
  state: TravelersState,
  personIndex: number,
  roomIndex: number,
): TravelersState {
  const normalized = normalizeTravelersState(state);
  if (
    personIndex < 0 ||
    personIndex >= getTotalTravelers(normalized) ||
    roomIndex < 0 ||
    roomIndex >= normalized.roomCount
  ) {
    return normalized;
  }

  const roomAssignments = [...normalized.roomAssignments];
  roomAssignments[personIndex] = roomIndex;

  return { ...normalized, roomAssignments };
}

/** Every child has a valid age (0-17); an incomplete state must not be searched. */
export function isTravelersStateComplete(state: TravelersState): boolean {
  return hasCompleteChildAges(normalizeTravelersState(state).childAges);
}

/** Canonical party model for URLs/providers. Children without an age are left out (blocked upstream). */
export function travelersStateToModel(state: TravelersState): TravelerModel {
  const normalized = normalizeTravelersState(state);
  const childAges: number[] = [];
  const assignments = normalized.roomAssignments.slice(0, normalized.adults);
  normalized.childAges.forEach((age, index) => {
    if (age !== null) {
      childAges.push(age);
      assignments.push(normalized.roomAssignments[normalized.adults + index] ?? 0);
    }
  });
  const persons = normalized.adults + childAges.length;
  const roomCount = clampRoomCount(normalized.roomCount, persons);
  return {
    adults: normalized.adults,
    childAges,
    roomCount,
    roomAssignments: normalizeAssignments(assignments, persons, roomCount),
  };
}

export type PartyTraveller = PartyMember;

/** Single writer: delegates to the central traveller URL contract (never writes a date of birth). */
export function writeTravelersToQuery(query: URLSearchParams, state: TravelersState): void {
  writeTravelerQuery(query, travelersStateToModel(state));
}

export function parseTravelersFromQuery(input: TravelerQueryInput): TravelersState | null {
  const parsed = readTravelerQuery(input);
  if (!parsed) {
    return null;
  }
  return buildState(parsed.adults, parsed.childAges, parsed.roomCount, parsed.roomAssignments);
}

export function travelersStateToParty(state: TravelersState): PartyTraveller[] {
  return partyFromModel(travelersStateToModel(state));
}