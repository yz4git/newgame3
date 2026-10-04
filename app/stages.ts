/** Shared campaign, scenery and sound metadata. No renderer dependencies. */
export type Environment = 'asteroids'|'ocean'|'fortress'|'ice'|'jungle'|'lava';
export const STAGES = [
  {name:'ASTEROID FRONT',jp:'小惑星帯の前線',boss:'AEGIS / 環状防衛艦',duration:64,color:0xc598ff,environment:'asteroids',bossStyle:0,sky:0x050919,sun:0xffe6d4,light:3.8,haze:0x8580bc,music:55,zones:['drift','outpost','wreckage','orbital-ring','citadel'],limits:[44,112,160,234]},
  {name:'PELAGIC BASE',jp:'蒼海の海上基地',boss:'LEVIATHAN / 海上制圧艦',duration:74,color:0x49e4ff,environment:'ocean',bossStyle:1,sky:0x063c59,sun:0xe5f4ff,light:3.2,haze:0xc0e7ee,music:65.406,zones:['open-sea','docks','fleet','platforms','command'],limits:[52,124,202,284]},
  {name:'ORBITAL FORTRESS',jp:'宇宙要塞の回廊',boss:'HELIX / 星核要塞',duration:82,color:0x49baff,environment:'fortress',bossStyle:2,sky:0x040c18,sun:0xffe8d2,light:3.8,haze:0x617a9b,music:49,zones:['harbor','city','garden','spaceport','defense'],limits:[44,112,160,274]},
  {name:'GLACIER CHASM',jp:'氷晶の峡谷',boss:'BOREALIS / 極地守護艦',duration:78,color:0x9aeaff,environment:'ice',bossStyle:0,sky:0x082d4c,sun:0xd8eeff,light:2.5,haze:0xb1ddeb,music:58.27,zones:['snowfields','crevasse','crystals','research','ice-gate'],limits:[50,126,204,276]},
  {name:'VERDANT RELIC',jp:'密林の古代遺跡',boss:'SERAPH / 遺跡防衛機',duration:82,color:0x71ffe0,environment:'jungle',bossStyle:1,sky:0x031d20,sun:0xffe3ac,light:3.0,haze:0xa0ba85,music:61.735,zones:['river','canopy','waterfalls','sanctuary','temple'],limits:[52,136,220,292]},
  {name:'VULCAN FOUNDRY',jp:'溶岩の兵器工場',boss:'VULCAN / 熔星中枢',duration:86,color:0xff8c38,environment:'lava',bossStyle:2,sky:0x190909,sun:0xffd0a2,light:3.0,haze:0x99685a,music:46.249,zones:['basalt','lava-channel','conveyors','smelters','furnace'],limits:[58,144,228,306]},
] as const;
