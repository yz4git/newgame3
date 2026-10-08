/** Lightweight loadouts: mobility, power and armor each have an explicit tradeoff. */
export const SHIPS={
 striker:{label:'STRIKER',speed:1,damage:1,hullOffset:0,tint:0xffffff},
 falcon:{label:'FALCON',speed:1.18,damage:1.16,hullOffset:-1,tint:0x9ddaff},
 bulwark:{label:'BULWARK',speed:.88,damage:.93,hullOffset:1,tint:0xffd4a5}
} as const;
export type ShipClass=keyof typeof SHIPS;
