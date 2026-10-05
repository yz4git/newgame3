import type {Boss} from './sim.ts';
export function bossWingAngle(stage:number,side:number,t:number,deploy:number){const amount=[.026,.012,.018,.034,.044,.016][stage];return side*(Math.sin(t*(stage===4?2.2:1.15)+stage)*amount+(1-deploy)*.095);}
export function bossScars(b:Pick<Boss,'hp'|'maxHp'>){return Math.min(.65,Math.max(0,1-b.hp/b.maxHp)**1.5*.65);}
export const scarPositions=[[-1,.55,.82],[.94,1.6,.72],[-.72,-2.15,.78]];
