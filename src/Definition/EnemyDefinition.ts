import type { TankStats } from "./TankDefinition";
import type { MinePlacementPattern } from "./MineDefinition";


export type EnemyModel =
  | "enemy_01"
  | "enemy_02"
  | "enemy_03"
  | "enemy_04"
  | "enemy_05"
  | "player";

export type EnemyType =
  | 'highspeed'
  | 'typeA'
  | 'typeB'
  | 'typeC'
  | 'detect'
  | 'command'
  | 'split'
  | 'triangle'
  | 'pentagon'
  | 'missile'
  | 'curve'
  | 'camouflage'
  | 'multimine'
  | 'selectmine'
  | 'apmodel'
  | 'destroy'
  | 'squadron'
  | 'godofall';


/** ステージに最大1体しか配置できない敵タイプ */
export const SINGLETON_ENEMY_TYPES: ReadonlySet<EnemyType> = new Set<EnemyType>([
    'destroy',
    'squadron',
]);

/** 地雷を使用する敵タイプ */
export type MineEnemyType = Extract<EnemyType,
    | 'highspeed'
    | 'typeB'
    | 'typeC'
    | 'camouflage'
    | 'multimine'
    | 'selectmine'
    | 'squadron'
    | 'godofall'
>;

/** 敵タンクのステータス定義 */
export const ENEMY_STATS: Record<EnemyType, TankStats> = {
    highspeed: {
        bulletType: 'ShockPulse',
        bulletCount: 7,
        reflectCount: 1,
        reloadTime: 0.2,
        mineType: 'select',
        mineCount: 2,
        mineDetection: true,
        speed: 4,
        turretRotationSpeed: Math.PI*2,
    },
    typeA: {
        bulletType: 'ShockPulse',
        bulletCount: 3,
        reflectCount: 1,
        reloadTime: 5,
        mineType: 'none',
        mineCount: 0,
        mineDetection: false,
        speed: 1,
        turretRotationSpeed: Math.PI*8,
    },
    typeB: {
        bulletType: 'ShockPulse',
        bulletCount: 4,
        reflectCount: 1,
        reloadTime: 0.7,
        mineType: 'wide', // S
        mineCount: 2,
        mineDetection: false,
        speed: 2,
        turretRotationSpeed: Math.PI/2,
    },
    typeC: {
        bulletType: 'ShockPulse',
        bulletCount: 6,
        reflectCount: 1,
        reloadTime: 0.5,
        mineType: 'wide', // S
        mineCount: 3,
        mineDetection: true,
        speed: 3,
        turretRotationSpeed: Math.PI,
    },
    detect: {
        bulletType: 'ShockPulse',
        bulletCount: 2,
        reflectCount: 1,
        reloadTime: 5,
        mineType: 'none',
        mineCount: 0,
        mineDetection: true,
        speed: 0,
        turretRotationSpeed: Math.PI*8,
    },
    command: {
        bulletType: 'ShockPulse',
        bulletCount: 6,
        reflectCount: 1,
        reloadTime: 0.2,
        mineType: 'none',
        mineCount: 0,
        mineDetection: false,
        speed: 0,
        turretRotationSpeed: Math.PI*2,
    },
    split: {
        bulletType: 'ClusterBolt',
        bulletCount: 4,
        reflectCount: 1,
        reloadTime: 3,
        mineType: 'none',
        mineCount: 0,
        mineDetection: false,
        speed: 3,
        turretRotationSpeed: Math.PI,
    },
    triangle: {
        bulletType: 'ShockPulse_HV',
        bulletCount: 3,
        reflectCount: 3,
        reloadTime: 3,
        mineType: 'none',
        mineCount: 0,
        mineDetection: false,
        speed: 0,
        turretRotationSpeed: Math.PI/2,
    },
    pentagon: {
        bulletType: 'ShockPulse_HV',
        bulletCount: 4,
        reflectCount: 5,
        reloadTime: 3,
        mineType: 'none',
        mineCount: 0,
        mineDetection: false,
        speed: 0,
        turretRotationSpeed: Math.PI,
    },
    missile: {
        bulletType: 'ShockPulse_HV',
        bulletCount: 4,
        reflectCount: 0,
        reloadTime:  1,
        mineType: 'none',
        mineCount: 0,
        mineDetection: true,
        speed: 2,
        turretRotationSpeed: Math.PI/2,
    },
    curve: {
        bulletType: 'ShockPulse_HV',
        bulletCount: 4,
        reflectCount: 1,
        reloadTime: 0.2,
        mineType: 'none',
        mineCount: 0,
        mineDetection: false,
        speed: 3,
        turretRotationSpeed: Math.PI,
    },
    camouflage: {
        bulletType: 'ShockPulse',
        bulletCount: 3,
        reflectCount: 0,
        reloadTime: 0.5,
        mineType: 'select',
        mineCount: 2,
        mineDetection: true,
        speed: 2,
        turretRotationSpeed: Math.PI/2,
    },
    multimine: {
        bulletType: 'ShockPulse',
        bulletCount: 3,
        reflectCount: 1,
        reloadTime: 2,
        mineType: 'wide',
        mineCount: 5,
        mineDetection: true,
        speed: 3,
        turretRotationSpeed: Math.PI/4,
    },
    selectmine: {
        bulletType: 'ShockPulse',
        bulletCount: 6,
        reflectCount: 1,
        reloadTime: 0.5,
        mineType: 'select',
        mineCount: 6,
        mineDetection: true,
        speed: 4,
        turretRotationSpeed: Math.PI,
    },
    apmodel: {
        bulletType: 'CoreBreaker',
        bulletCount: 1,
        reflectCount: 0,
        reloadTime: 3,
        mineType: 'none',
        mineCount: 0,
        mineDetection: true,
        speed: 4,
        turretRotationSpeed: Math.PI*2,
    },
    destroy: {
        bulletType: 'CoreBreaker_Spread',
        bulletCount: 1,
        reflectCount: 0,
        reloadTime: 2,
        mineType: 'none',
        mineCount: 0,
        mineDetection: true,
        speed: 5,
        turretRotationSpeed: Math.PI*4,
    },
    squadron: {
        bulletType: 'CoreBreaker_Spread',
        bulletCount: 2,
        reflectCount: 0,
        reloadTime: 1,
        mineType: 'select', // B
        mineCount: 1,
        mineDetection: true,
        speed: 5,
        turretRotationSpeed: Math.PI*4,
    },
    godofall: {
        bulletType: 'ShockPulse',
        bulletCount: 8,
        reflectCount: 3,
        reloadTime: 0.2,
        mineType: 'select', // B
        mineCount: 5,
        mineDetection: true,
        speed: 5,
        turretRotationSpeed: Math.PI*4,
    },
};

/** 地雷設置パターン定義 */
export const ENEMY_MINE_PLACEMENT: Record<MineEnemyType, MinePlacementPattern> = {
    highspeed:  'passage',
    typeB:      'negative',
    typeC:      'negative',
    camouflage: 'passage',
    multimine:  'positive',
    selectmine: 'passage',
    squadron:   'passage',
    godofall:   'negative',
};

/** 透明車体を持つ敵タイプ */
export const TRANSPAREN_TANK = ['camouflage', 'squadron'] as const satisfies readonly EnemyType[];


/** 敵タイプ → 使用する3Dモデルキーの対応表 */
export const ENEMY_MODEL_MAP: Record<EnemyType, EnemyModel> = {
    highspeed:  'enemy_05',
    typeA:      'enemy_01',
    typeB:      'enemy_02',
    typeC:      'enemy_02',
    detect:     'enemy_01',
    command:    'enemy_01',
    split:      'enemy_05',
    triangle:   'enemy_03',
    pentagon:   'enemy_03',
    missile:    'enemy_03',
    curve:      'enemy_03',
    camouflage: 'enemy_05',
    multimine:  'enemy_02',
    selectmine: 'enemy_02',
    apmodel:    'enemy_04',
    destroy:    'enemy_04',
    squadron:   'enemy_04',
    godofall:   'player',
};

/** 敵タンクの配色（Mat_Main / Mat_Sub） */
export interface EnemyColors {
    main: number;
    sub:  number;
}

/**
 * 色相環を均等に分散させた配色定義。
 * 同じステージに並べたとき、隣り合うタンクが同系色にならないことを優先している。
 * godofall の虹エフェクトは将来的にアニメーションで実装予定。
 */
export const ENEMY_COLORS: Record<EnemyType, EnemyColors> = {
    destroy:    { main: 0xDD0000, sub: 0x600000 }, // 赤     ～  0°
    split:      { main: 0xFF4400, sub: 0x6A1800 }, // 赤橙   ～ 12°
    highspeed:  { main: 0xFF8800, sub: 0x6A3400 }, // 橙     ～ 30°
    selectmine: { main: 0xFFAA00, sub: 0x5A4000 }, // 琥珀   ～ 40°
    command:    { main: 0xFFCC00, sub: 0x5A4800 }, // 金     ～ 50°（指揮官）
    multimine:  { main: 0xEEDD00, sub: 0x504800 }, // 黄     ～ 58°
    triangle:   { main: 0x88FF00, sub: 0x2E5000 }, // 黄緑   ～ 90°
    pentagon:   { main: 0x00EE88, sub: 0x005038 }, // 翠緑   ～150°
    curve:      { main: 0x00DDBB, sub: 0x005044 }, // 翡翠   ～173°
    typeB:      { main: 0x00BBFF, sub: 0x003A6A }, // 水色   ～205°
    typeA:      { main: 0x2277FF, sub: 0x0A1A70 }, // 青     ～225°
    apmodel:    { main: 0x5500DD, sub: 0x1E0060 }, // 藍紫   ～260°
    detect:     { main: 0x9933FF, sub: 0x33006A }, // 紫     ～270°（センサー）
    typeC:      { main: 0xCC33FF, sub: 0x4A0060 }, // 薄紫   ～285°
    missile:    { main: 0xFF0077, sub: 0x7A0030 }, // ピンク ～330°
    camouflage: { main: 0xB0B8B0, sub: 0x404840 }, // 灰     ──（透明ボディ）
    squadron:   { main: 0x880044, sub: 0x300018 }, // 暗赤紫 ──（透明ボディ）
    godofall:   { main: 0x00983A, sub: 0x004A1D }, // ルイージ：緑
};
