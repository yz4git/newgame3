import type {Difficulty} from './sim.ts';
/** Combat tuning: deliberate difficulty differences without changing collision fairness. */
export const DIFFICULTY_BALANCE={
 casual:{extendEvery:75000,stageRepairBelow:4,hitInvulnerable:3.65,hitBombFloor:3,bossHealth:0.9,missionHealth:0.92},
 normal:{extendEvery:110000,stageRepairBelow:2,hitInvulnerable:2.85,hitBombFloor:1,bossHealth:1,missionHealth:1},
 expert:{extendEvery:145000,stageRepairBelow:1,hitInvulnerable:2.35,hitBombFloor:0,bossHealth:1.17,missionHealth:1.12}
} as const satisfies Record<Difficulty,{extendEvery:number;stageRepairBelow:number;hitInvulnerable:number;hitBombFloor:number;bossHealth:number;missionHealth:number}>;
export function stageRecovery(hull:number,difficulty:Difficulty){return hull<=DIFFICULTY_BALANCE[difficulty].stageRepairBelow?1:0;}
export function regainBombAfterHit(bombs:number,difficulty:Difficulty){return bombs<DIFFICULTY_BALANCE[difficulty].hitBombFloor?1:0;}
