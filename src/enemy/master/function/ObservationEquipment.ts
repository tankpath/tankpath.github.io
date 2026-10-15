// タンクの位置座標、地雷の場所の監視

import * as THREE from 'three';
import type { Tank } from '../../../object/tank/Tank';
import { StageObjectManager } from '../../../managers/StageObjectManager';
import { PlayerAnalyzer } from '../../../Analyze/PlayerAnalyzer';

/** ルート計算などに渡す地雷の観測データ */
export interface MineObservation {
    /** 地雷のワールド座標 */
    position: THREE.Vector3;
    /** 爆発半径（セル単位） */
    explosionRange: number;
}

export class ObservationEquipment {
    private static _instance: ObservationEquipment;

    private _playerTanks: Tank[] = [];
    /** Tank → PlayerAnalyzer の playerId（登録順に付番） */
    private _tankPlayerIds: Map<Tank, number> = new Map();
    private _cachedMines: MineObservation[] = [];

    private constructor() {}

    static get instance(): ObservationEquipment {
        if (!this._instance) this._instance = new ObservationEquipment();
        return this._instance;
    }

    /**
     * プレイヤータンクを監視対象として登録する（重複登録は無視）。
     * 登録後、PlayerAnalyzer のスコア降順（高評価が先頭）に並べ替える。
     */
    register(tank: Tank): void {
        if (this._tankPlayerIds.has(tank)) return;
        const playerId = this._tankPlayerIds.size;
        this._tankPlayerIds.set(tank, playerId);
        this._playerTanks.push(tank);
        this._sortByScore();
    }

    /** PlayerAnalyzer スコア降順に _playerTanks を並べ替える */
    private _sortByScore(): void {
        const pa = PlayerAnalyzer.instance;
        this._playerTanks.sort((a, b) => {
            const scoreA = pa.getScore(this._tankPlayerIds.get(a)!);
            const scoreB = pa.getScore(this._tankPlayerIds.get(b)!);
            return scoreB - scoreA;
        });
    }

    /** 監視しているプレイヤータンク一覧を返す */
    get playerTanks(): Tank[] {
        return this._playerTanks;
    }

    /**
     * フィールド上の全地雷の位置と爆発範囲を返す（フレームごとにキャッシュ済み）。
     */
    get mineObservations(): MineObservation[] {
        return this._cachedMines;
    }

    /** BattleField のアニメーションループから毎フレーム呼ばれる */
    update(_delta: number): void {
        const mines = StageObjectManager.instance.allMines;
        if (this._cachedMines.length !== mines.length) {
            this._cachedMines = mines.map(({ mine }) => ({
                position: mine.object.position,
                explosionRange: mine.info.stats.explosionRange,
            }));
        } else {
            for (let i = 0; i < mines.length; i++) {
                this._cachedMines[i].position      = mines[i].mine.object.position;
                this._cachedMines[i].explosionRange = mines[i].mine.info.stats.explosionRange;
            }
        }
    }

    /** バトル終了時にリセットする */
    reset(): void {
        this._playerTanks  = [];
        this._tankPlayerIds = new Map();
        this._cachedMines   = [];
    }
}
