export type RoomTravelers = {
  adults: number;
  children: number;
  babies: number;
};

export type TravelersState = {
  rooms: RoomTravelers[];
};

export const MAX_TOTAL_TRAVELERS = 9;

export const TRAVELERS_LIMITS = {
  adults: { min: 1, max: 12, default: 2 },
  children: { min: 0, max: 8, default: 0 },
  babies: { min: 0, max: 8, default: 0 },
} as const;

export function createDefaultRoom(): RoomTravelers {
  return {
    adults: TRAVELERS_LIMITS.adults.default,
    children: TRAVELERS_LIMITS.children.default,
    babies: TRAVELERS_LIMITS.babies.default,
  };
}

export function createDefaultTravelersState(): TravelersState {
  return {
    rooms: [createDefaultRoom()],
  };
}

export function getRoomTotal(room: RoomTravelers): number {
  return room.adults + room.children + room.babies;
}

export function getTravelersTotals(rooms: RoomTravelers[]) {
  return rooms.reduce(
    (totals, room) => ({
      adults: totals.adults + room.adults,
      children: totals.children + room.children,
      babies: totals.babies + room.babies,
    }),
    { adults: 0, children: 0, babies: 0 },
  );
}

export function getTotalTravelers(rooms: RoomTravelers[]): number {
  const totals = getTravelersTotals(rooms);
  return totals.adults + totals.children + totals.babies;
}

export function formatTravelersLabel(rooms: RoomTravelers[]): string {
  const total = getTotalTravelers(rooms);

  if (total === 0) {
    return 'Reisgezelschap';
  }

  return total === 1 ? '1 persoon' : `${total} personen`;
}

export function canIncreaseField(
  state: TravelersState,
  roomIndex: number,
  field: keyof RoomTravelers,
): boolean {
  const room = state.rooms[roomIndex];
  if (!room) {
    return false;
  }

  const limits = TRAVELERS_LIMITS[field];
  if (room[field] >= limits.max) {
    return false;
  }

  return getTotalTravelers(state.rooms) < MAX_TOTAL_TRAVELERS;
}

export function canDecreaseField(room: RoomTravelers, field: keyof RoomTravelers): boolean {
  return room[field] > TRAVELERS_LIMITS[field].min;
}

export function canAddRoom(state: TravelersState): boolean {
  return getTotalTravelers(state.rooms) + getRoomTotal(createDefaultRoom()) <= MAX_TOTAL_TRAVELERS;
}

export function canShowAddRoomButton(state: TravelersState): boolean {
  return getTotalTravelers(state.rooms) < MAX_TOTAL_TRAVELERS;
}

export function updateRoomTravelers(
  state: TravelersState,
  roomIndex: number,
  field: keyof RoomTravelers,
  value: number,
): TravelersState {
  const limits = TRAVELERS_LIMITS[field];
  const clampedValue = Math.min(limits.max, Math.max(limits.min, value));
  const rooms = state.rooms.map((room, index) => {
    if (index !== roomIndex) {
      return room;
    }

    return { ...room, [field]: clampedValue };
  });

  if (getTotalTravelers(rooms) > MAX_TOTAL_TRAVELERS) {
    return state;
  }

  return { rooms };
}

export function increaseRoomField(
  state: TravelersState,
  roomIndex: number,
  field: keyof RoomTravelers,
): TravelersState {
  const room = state.rooms[roomIndex];
  if (!room || !canIncreaseField(state, roomIndex, field)) {
    return state;
  }

  return updateRoomTravelers(state, roomIndex, field, room[field] + 1);
}

export function decreaseRoomField(
  state: TravelersState,
  roomIndex: number,
  field: keyof RoomTravelers,
): TravelersState {
  const room = state.rooms[roomIndex];
  if (!room || !canDecreaseField(room, field)) {
    return state;
  }

  return updateRoomTravelers(state, roomIndex, field, room[field] - 1);
}

export function addRoom(state: TravelersState): TravelersState {
  if (!canAddRoom(state)) {
    return state;
  }

  return {
    rooms: [...state.rooms, createDefaultRoom()],
  };
}

export function removeRoom(state: TravelersState, roomIndex: number): TravelersState {
  if (state.rooms.length <= 1) {
    return state;
  }

  return {
    rooms: state.rooms.filter((_, index) => index !== roomIndex),
  };
}
