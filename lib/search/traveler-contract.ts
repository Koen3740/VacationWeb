/**
 * DEC-019 traveller contract - the single place that defines how a search party
 * is represented in URLs and SearchParams.
 *
 * - adults: count only (no age, no date of birth)
 * - children: age in whole years 0-17 on the calculated return date
 * - baby is not a separate input: age < 2 = baby, age >= 2 = child
 *
 * URL: `adults=2&childAges=5,1` (+ derived `children=1&babies=1`) and, only for
 * more than one room, `rooms=2&partyRooms=1,1,2,1` (one room number per person:
 * adults first, then children in `childAges` order). A VacationWeb URL never
 * carries a date of birth; legacy `dob=` links are still read.
 */

export const CHILD_AGE_MIN = 0;
export const CHILD_AGE_MAX = 17;
/** Ages below this are babies; this age and up are children. */
export const BABY_MAX_AGE_EXCLUSIVE = 2;
export const MAX_PARTY_TRAVELLERS = 9;
export const DEFAULT_ADULTS = 2;

/** One person of the party. `age === null` is an adult. `roomIndex` is 0-based. */
export type PartyMember = { age: number | null; roomIndex: number };

/** Canonical party: adults count + child ages + room layout (adults first, then children). */
export type TravelerModel = {
  adults: number;
  childAges: number[];
  roomCount: number;
  /** One 0-based room per person: adults first, then children in `childAges` order. */
  roomAssignments: number[];
};

export function isValidChildAge(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= CHILD_AGE_MIN &&
    value <= CHILD_AGE_MAX
  );
}

export function isBabyAge(age: number): boolean {
  return age < BABY_MAX_AGE_EXCLUSIVE;
}

export function deriveOccupancyCounts(
  adults: number,
  childAges: ReadonlyArray<number>,
): { adults: number; children: number; babies: number } {
  let children = 0;
  let babies = 0;
  for (const age of childAges) {
    if (isBabyAge(age)) {
      babies += 1;
    } else {
      children += 1;
    }
  }
  return { adults, children, babies };
}

function clampRoomCount(roomCount: number, persons: number): number {
  const maxRooms = Math.max(1, Math.min(MAX_PARTY_TRAVELLERS, persons));
  return Math.min(maxRooms, Math.max(1, Math.floor(roomCount)));
}

function normalizeAssignments(assignments: ReadonlyArray<number>, persons: number, roomCount: number): number[] {
  const next = Array.from({ length: persons }, (_, index) => {
    const value = assignments[index];
    return Number.isInteger(value) && value >= 0 && value < roomCount ? value : 0;
  });
  return roomCount <= 1 ? next.map(() => 0) : next;
}

/** Party members (adults first, then children) with their rooms. */
export function partyFromModel(model: TravelerModel): PartyMember[] {
  const party: PartyMember[] = [];
  for (let index = 0; index < model.adults; index += 1) {
    party.push({ age: null, roomIndex: model.roomAssignments[index] ?? 0 });
  }
  model.childAges.forEach((age, childIndex) => {
    party.push({ age, roomIndex: model.roomAssignments[model.adults + childIndex] ?? 0 });
  });
  return party;
}

/** Inverse of {@link partyFromModel}; members may arrive in any order. */
export function modelFromParty(
  party: ReadonlyArray<PartyMember>,
  roomsHint?: number,
): TravelerModel {
  const adultsRooms: number[] = [];
  const children: Array<{ age: number; roomIndex: number }> = [];
  for (const member of party) {
    if (member.age === null) {
      adultsRooms.push(member.roomIndex);
    } else {
      children.push({ age: member.age, roomIndex: member.roomIndex });
    }
  }
  const highest = party.reduce((max, member) => Math.max(max, member.roomIndex + 1), 1);
  const roomCount = clampRoomCount(Math.max(roomsHint ?? 1, highest), party.length);
  return {
    adults: adultsRooms.length,
    childAges: children.map((child) => child.age),
    roomCount,
    roomAssignments: normalizeAssignments(
      [...adultsRooms, ...children.map((child) => child.roomIndex)],
      party.length,
      roomCount,
    ),
  };
}

/**
 * The only writer of traveller query parameters (Results, pagination, filters,
 * sorting, detail, prefetch). Never writes a date of birth.
 */
export function writeTravelerQuery(query: URLSearchParams, model: TravelerModel): void {
  query.delete('dob');
  query.set('adults', String(model.adults));
  // `childAges` is always written (empty = adults only): it marks the current contract, so a
  // link without it is recognised as a legacy count-only / dob link.
  query.set('childAges', model.childAges.join(','));
  if (model.childAges.length > 0) {
    const counts = deriveOccupancyCounts(model.adults, model.childAges);
    if (counts.children > 0) {
      query.set('children', String(counts.children));
    } else {
      query.delete('children');
    }
    if (counts.babies > 0) {
      query.set('babies', String(counts.babies));
    } else {
      query.delete('babies');
    }
  } else {
    query.delete('children');
    query.delete('babies');
  }
  if (model.roomCount > 1) {
    query.set('rooms', String(model.roomCount));
    query.set('partyRooms', model.roomAssignments.map((room) => String(room + 1)).join(','));
  } else {
    query.delete('rooms');
    query.delete('partyRooms');
  }
}

/**
 * Writer for parsed SearchParams: a known party goes through
 * {@link writeTravelerQuery}; legacy count-only searches keep their raw counts.
 */
export function writeTravelerQueryFromParams(
  query: URLSearchParams,
  params: {
    adults?: number;
    children?: number;
    babies?: number;
    rooms?: number;
    party?: ReadonlyArray<PartyMember>;
  },
): void {
  if (params.party && params.party.length > 0) {
    writeTravelerQuery(query, modelFromParty(params.party, params.rooms));
    return;
  }
  query.delete('dob');
  query.delete('childAges');
  query.delete('partyRooms');
  const set = (key: string, value: number | undefined) => {
    if (value !== undefined && !Number.isNaN(value)) {
      query.set(key, String(value));
    }
  };
  set('adults', params.adults);
  set('children', params.children);
  set('babies', params.babies);
  set('rooms', params.rooms);
}

export type TravelerQueryInput = {
  adults?: string;
  children?: string;
  babies?: string;
  childAges?: string;
  /** Legacy only; never written. */
  dob?: string;
  partyRooms?: string;
  rooms?: string;
};

export type ParsedTravelerQuery = {
  adults: number;
  /** `null` = child without a known age (legacy count-only links). */
  childAges: Array<number | null>;
  roomCount: number;
  roomAssignments: number[];
  source: 'childAges' | 'legacy-dob' | 'legacy-counts';
};

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Whole-year age of an ISO birth date on `today`; `null` when not a valid past date. */
export function legacyAgeFromIso(iso: string, today: Date = new Date()): number | null {
  const match = ISO_DATE.exec(iso.trim());
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const birth = new Date(year, month - 1, day);
  if (birth.getFullYear() !== year || birth.getMonth() !== month - 1 || birth.getDate() !== day) {
    return null;
  }
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (birth.getTime() > todayStart.getTime()) {
    return null;
  }
  let age = today.getFullYear() - year;
  const monthDelta = today.getMonth() - (month - 1);
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < day)) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

function parsePartyRooms(raw: string | undefined): number[] {
  return typeof raw === 'string' ? raw.split(',').map((value) => Number(value.trim()) - 1) : [];
}

function finishParsed(
  adults: number,
  childAges: Array<number | null>,
  assignmentsRaw: number[],
  roomsRaw: string | undefined,
  source: ParsedTravelerQuery['source'],
): ParsedTravelerQuery {
  const persons = adults + childAges.length;
  const fromAssignments = assignmentsRaw.reduce(
    (highest, value) => (Number.isInteger(value) && value >= 0 ? Math.max(highest, value + 1) : highest),
    1,
  );
  const requested = Number(roomsRaw);
  const roomCount = clampRoomCount(
    Math.max(Number.isFinite(requested) && requested > 0 ? requested : 1, fromAssignments),
    persons,
  );
  return {
    adults,
    childAges,
    roomCount,
    roomAssignments: normalizeAssignments(assignmentsRaw, persons, roomCount),
    source,
  };
}

/**
 * The only reader of traveller query parameters. Order of precedence:
 * `childAges` (current contract) > `dob` (legacy, ages as of `today`) >
 * `adults`/`children`/`babies` counts (legacy, child ages unknown).
 */
export function readTravelerQuery(
  input: TravelerQueryInput,
  today: Date = new Date(),
): ParsedTravelerQuery | null {
  if (typeof input.childAges === 'string') {
    const adultsRaw = Number(input.adults);
    const adults = Math.min(
      MAX_PARTY_TRAVELLERS,
      Number.isFinite(adultsRaw) && adultsRaw >= 1 ? Math.floor(adultsRaw) : DEFAULT_ADULTS,
    );
    const childAges: Array<number | null> = input.childAges
      .split(',')
      .map((token) => token.trim())
      .filter((token) => token !== '')
      .map((token) => {
        const value = Number(token);
        return isValidChildAge(value) ? value : null;
      })
      .slice(0, MAX_PARTY_TRAVELLERS - adults);
    return finishParsed(adults, childAges, parsePartyRooms(input.partyRooms), input.rooms, 'childAges');
  }

  if (typeof input.dob === 'string' && input.dob.split(',').some((token) => token.trim() !== '')) {
    const tokens = input.dob.split(',').slice(0, MAX_PARTY_TRAVELLERS);
    const rooms = parsePartyRooms(input.partyRooms);
    const persons = tokens.map((token, index) => {
      const age = token.trim() ? legacyAgeFromIso(token) : null;
      const room = rooms[index];
      return {
        age: age !== null && age < 18 ? age : null,
        room: Number.isInteger(room) && room >= 0 ? room : 0,
      };
    });
    if (persons.every((person) => person.age !== null)) {
      // A search needs an adult; promote the first person.
      persons[0] = { age: null, room: persons[0].room };
    }
    const adultPersons = persons.filter((person) => person.age === null);
    const childPersons = persons.filter((person) => person.age !== null);
    return finishParsed(
      adultPersons.length,
      childPersons.map((person) => person.age as number),
      [...adultPersons, ...childPersons].map((person) => person.room),
      input.rooms,
      'legacy-dob',
    );
  }

  const adults = Number(input.adults);
  const children = Number(input.children);
  const babies = Number(input.babies);
  const rooms = Number(input.rooms);
  const hasCounts =
    (Number.isFinite(adults) && adults > 0) ||
    (Number.isFinite(children) && children > 0) ||
    (Number.isFinite(babies) && babies > 0) ||
    (Number.isFinite(rooms) && rooms > 0);
  if (!hasCounts) {
    return null;
  }
  const adultCount = Math.min(
    MAX_PARTY_TRAVELLERS,
    Number.isFinite(adults) && adults > 0 ? Math.floor(adults) : DEFAULT_ADULTS,
  );
  const unknownChildren =
    (Number.isFinite(children) && children > 0 ? Math.floor(children) : 0) +
    (Number.isFinite(babies) && babies > 0 ? Math.floor(babies) : 0);
  const childAges: Array<number | null> = Array.from(
    { length: Math.min(unknownChildren, MAX_PARTY_TRAVELLERS - adultCount) },
    () => null,
  );
  return finishParsed(adultCount, childAges, [], input.rooms, 'legacy-counts');
}

/** All child ages known (valid 0-17)? Incomplete parties must not be searched. */
export function hasCompleteChildAges(childAges: ReadonlyArray<number | null>): childAges is number[] {
  return childAges.every((age) => isValidChildAge(age));
}