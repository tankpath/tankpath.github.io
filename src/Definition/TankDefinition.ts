/** 弾の種類 */
import type { ShellType } from "./ShellDefinition";

/** 地雷の種類 */
import type { MineType } from "./MineDefinition";


export const SPEED_GEAR = {
    0: 0,
    1: 0.5,
    2: 0.7,
    3: 0.85,
    4: 1,
    5: 1.2,
} as const;

export type GearLevel = keyof typeof SPEED_GEAR;

/** タンクのステータス */
export interface TankStats {
    /** 弾の種類 */
    bulletType: ShellType;
    /** 最大弾数（同時に発射できる数） */
    bulletCount: number;
    /** 弾の最大反射回数 */
    reflectCount: number;
    /** 装填時間（秒） */
    reloadTime: number;
    /** 設置する地雷の種類 */
    mineType: MineType;
    /** 最大地雷設置数 */
    mineCount: number;
    /** 地雷探知できるか */
    mineDetection: boolean;
    /** 移動速度（ギア倍数） */
    speed: GearLevel;
    /** 砲塔回転速度（rad/s）。Math.PI * 4 = 1回転0.5秒 */
    turretRotationSpeed: number;
    /** 配色テーマはあとで決める */
}

/** プレイヤーの種類（最大4人対応） */
export type PlayerType =
  | 'player1'
  | 'player2'
  | 'player3'
  | 'player4';

// タンクの種類（敵 + プレイヤー）
export type TankType =
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
  | 'godofall'
  | PlayerType;

export function isPlayerType(type: TankType): type is PlayerType {
    return type === 'player1' || type === 'player2' || type === 'player3' || type === 'player4';
}

/** タンクの配色（Mat_Main / Mat_Sub） */
export interface TankColors {
    main: number;
    sub:  number;
}

/**
 * プレイヤータンクのデフォルト配色。
 * ソロミッションでは player1（マリオ：赤）が使われる。
 * 将来のマルチプレイヤーでは呼び出し元が好みの色を渡して上書きできる。
 */
export const PLAYER_COLORS: Record<PlayerType, TankColors> = {
    player1: { main: 0xE60012, sub: 0x7A0009 }, // マリオ：赤
    player2: { main: 0x0044CC, sub: 0x00204A }, // 予備
    player3: { main: 0xFFCC00, sub: 0x665200 }, // 予備
    player4: { main: 0xCC6600, sub: 0x663300 }, // 予備
};

