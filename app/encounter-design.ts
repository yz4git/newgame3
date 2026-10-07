export const ENCOUNTERS=[
 {mini:'KESTREL / 軌道哨戒機',event:'ORBITAL SHIELD / 回転防壁',hint:'発生器を壊して旋回弾を止める',color:0xc598ff},
 {mini:'TRIDENT / 艦隊護衛艦',event:'FLEET AMBUSH / 艦隊襲撃',hint:'左右の砲台を崩して艦隊を突破',color:0x55e8ff},
 {mini:'BASTION / 要塞迎撃機',event:'POWER GATE / 電源ゲート',hint:'電源を撃破するとレーザーが停止',color:0x64baff},
 {mini:'MIRROR / 氷晶反射機',event:'PRISM CROSSING / 反射装置',hint:'反射装置を壊して跳弾を止める',color:0xa5eeff},
 {mini:'TOTEM / 古代守護機',event:'RELIC SWARM / 防衛ビット',hint:'ビットを破壊して本体を露出',color:0x78ffd0},
 {mini:'CRUCIBLE / 炉圧護衛機',event:'PRESSURE LOCK / 炉圧弁',hint:'炉圧弁を撃破して放射を減らす',color:0xffab54},
] as const;
export const BOSS_ATTACKS=[
 ['ORBITAL GATE / 回転防壁','PINCH ARRAY / 挟撃砲台','SHIELD LANCE / 防壁レーザー'],
 ['FLEET SALVO / 艦隊一斉射','TORPEDO CROSS / 交差魚雷','BROADSIDES / 舷側射撃'],
 ['POWER LATTICE / 電源レーザー網','RAIL SWEEP / 走査砲撃','CITADEL LOCK / 要塞照準'],
 ['MIRROR FIELD / 反射弾幕','CRYSTAL COMB / 氷晶の櫛','PRISM LANCES / 交差光槍'],
 ['BIT ORBIT / 分離ビット','PETAL SPIRAL / 花弁旋回','RELIC PULSE / 古代炉の波'],
 ['PRESSURE SALVO / 炉圧連射','VENT LANCES / 放熱光槍','FURNACE SURGE / 炉の暴走'],
] as const;
export interface Threat {id:number;source:number;ax:number;ay:number;bx:number;by:number;width:number;age:number;warmup:number;duration:number;dead:boolean;}
export interface CombatNode {id:number;owner:number;attach:'stage'|'mini'|'boss'|'field';index:number;stage:number;x:number;y:number;baseX:number;baseY:number;hp:number;maxHp:number;radius:number;age:number;life:number;shoot:number;flash:number;dead:boolean;}
export interface Miniboss {id:number;stage:number;x:number;y:number;hp:number;maxHp:number;age:number;shoot:number;flash:number;attack:number;cycle:number;dead:boolean;}
export function encounterTimes(stage:number,duration:number){return {event:duration*.18,mini:duration*.42};}
export function threatActive(t:Threat){return !t.dead&&t.age>=t.warmup&&t.age<t.warmup+t.duration;}
export function miniAngle(m:Miniboss){return Math.sin(m.age*(m.stage===4?1.2:.55))*(m.stage===4?.08:.025);}
