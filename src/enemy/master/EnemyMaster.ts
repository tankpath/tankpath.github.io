// 各エネミーのマスター
/**　やること
 * 　各エネミーの初期ロード、接続
 * 　エネミーに登録する内容の決定
 * 　AIレベルの管理
 * 　functionの内容の登録
 * 　もらう：計算依頼（反射、ルート）
 * 　わたす：計算結果（反射、ルート）
 */

import * as THREE from 'three';
import type { Tank } from '../../object/tank/Tank';
import type { BattleFieldConfig } from '../../scene/battle/BattleField';
import type { AI_LEVEL as AILevelType } from '../../Definition/AILevel';
import type { EnemyType } from '../../Definition/EnemyDefinition';
import { DecideCharacter, type ResolvedCharacter } from './function/DecideCharacter';
import { RouteCalculator, type Cell } from './function/RouteCalculator';
import { EscapeRouteCalculator } from './function/EscapeRouteCalculator';
import { ReflectCalculator } from './function/ReflectCalculator';
import { StageObjectManager } from '../../managers/StageObjectManager';
import { AIManager } from '../../managers/AIManager';
import { ENEMY_CHARACTERS } from '../../Definition/EnemyCharacter';
import { Simple_ReflectC } from './function/Simple_ReflectC';

/** EnemyMaster が各敵タンクごとに保持する情報 */
interface EnemyRecord {
    tank: Tank;
    character: ResolvedCharacter;
    aiLevel: AILevelType;
}

export class EnemyMaster {
    private static _instance: EnemyMaster;

    private _config: BattleFieldConfig | null = null;
    private _scene: THREE.Scene | null = null;
    private _enemies: Map<string, EnemyRecord> = new Map();
    private readonly _routeCalc = new RouteCalculator();
    private readonly _escapeCalc = new EscapeRouteCalculator();
    private readonly _reflectCalc = new ReflectCalculator();
    private readonly _simpleReflectCalc = new Simple_ReflectC();

    /** shellBlocker セルのグリッドキャッシュ（壁変更時に null でリセット） */
    private _blockedGrid: boolean[][] | null = null;

    /** 個別エネミー AI の毎フレーム更新コールバック */
    private _updaters: ((delta: number) => void)[] = [];

    private constructor() {}

    static get instance(): EnemyMaster {
        if (!this._instance) this._instance = new EnemyMaster();
        return this._instance;
    }

    // ─── セットアップ ──────────────────────────────────────────

    /**
     * バトル開始時に呼ぶ。フィールド設定とシーンを受け取る。
     * @param config フィールドのグリッド設定
     * @param scene  デバッグ用ルート可視化に用いる Three.js シーン
     */
    setup(config: BattleFieldConfig, scene: THREE.Scene): void {
        this._config = config;
        this._scene  = scene;
        this._routeCalc.initPoints(config);
        StageObjectManager.instance.onCubeChanged(() => {
            this._blockedGrid = null;
            this._routeCalc.invalidateGrid();
            this._escapeCalc.invalidateGrid();
        });
    }

    // ─── 敵の登録 ─────────────────────────────────────────────

    /**
     * 敵タンクを登録し、性格とAIレベルを決定する。
     * EnemyAI インスタンス生成前に呼ぶこと。
     */
    registerEnemy(tank: Tank): void {
        if (tank.info.isPlayer) return;

        const character = DecideCharacter.decide(tank.info.type as EnemyType);
        const aiLevel   = AIManager.instance.decideAILevel();

        this._enemies.set(tank.info.id, { tank, character, aiLevel });
    }

    // ─── 情報取得 ─────────────────────────────────────────────

    /**
     * 登録済み敵の確定した性格を返す。
     * 個別エネミーAIが自分の行動スタイルを参照するために使う。
     */
    getCharacter(tankId: string): ResolvedCharacter | null {
        return this._enemies.get(tankId)?.character ?? null;
    }

    /** 登録済み敵のAIレベルを返す。 */
    getAILevel(tankId: string): AILevelType | null {
        return this._enemies.get(tankId)?.aiLevel ?? null;
    }

    // ─── 性格変更 ─────────────────────────────────────────────

    /**
     * shootingType を更新する。
     * @param isPlayerClose true のとき rapid を強制。false のとき確率で再抽選。
     */
    rerandomizeShootingType(tankId: string, isPlayerClose: boolean): void {
        const record = this._enemies.get(tankId);
        if (!record) return;
        if (isPlayerClose) {
            record.character.shootingType = 'rapid';
            return;
        }
        const weights = ENEMY_CHARACTERS[record.tank.info.type as EnemyType].shootingType;
        record.character.shootingType = DecideCharacter.pickShootingType(weights);
    }

    /**
     * shotPattern を再抽選して更新する。
     * shootingMethod が 0 または 1 の場合は固定値のため更新しない。
     */
    rerandomizeShotPattern(tankId: string): void {
        const record = this._enemies.get(tankId);
        if (!record) return;
        const prob = ENEMY_CHARACTERS[record.tank.info.type as EnemyType].shootingMethod;
        if (prob === 0 || prob === 1) return;
        record.character.shotPattern = Math.random() < prob ? 'reflect' : 'direct';
    }

    /** distancePref を再抽選して更新する。 */
    rerandomizeDistancePref(tankId: string): void {
        const record = this._enemies.get(tankId);
        if (!record) return;
        const weights = ENEMY_CHARACTERS[record.tank.info.type as EnemyType].fromPlayer;
        record.character.distancePref = DecideCharacter.pickDistancePref(weights);
    }

    // ─── 計算依頼の仲介 ──────────────────────────────────────

    /**
     * ルート計算を依頼し、結果のセル列を返す。
     * 地雷の爆発範囲のみを加味したルートを計算する。
     * 後退や突撃などの特殊行動は requestSpecialRoute を使うこと。
     * @param tankId 依頼元の敵タンクID
     * @param from   出発位置（ワールド座標）
     */
    requestRoute(tankId: string, from: THREE.Vector3, exitedOwnMines: Set<string>): Cell[] {
        const record = this._enemies.get(tankId);
        if (!record || !this._config) return [];

        // ポイント到達ごとに distancePref を再抽選する
        this.rerandomizeDistancePref(tankId);

        const mineDetection = record.tank.info.stats.mineDetection;
        return this._routeCalc.calculate(tankId, from, record.character, this._config, mineDetection, exitedOwnMines, this._scene ?? undefined);
    }

    /**
     * 特殊条件付きルート計算を依頼し、結果のセル列を返す。
     * @param tankId    依頼元の敵タンクID
     * @param from      出発位置（ワールド座標）
     * @param isCharge  true: target へ向かう突撃ルート / false: プレイヤーに遭遇しない回避ルート
     * @param isZigzag  true: ジグザグ移動を混ぜたルートを返す
     * @param target    isCharge=true のときのターゲット位置（ワールド座標）
     */
    requestSpecialRoute(
        tankId: string,
        from: THREE.Vector3,
        isCharge: boolean,
        isZigzag: boolean,
        target: THREE.Vector3,
        exitedOwnMines: Set<string>,
    ): Cell[] {
        const record = this._enemies.get(tankId);
        if (!record || !this._config) return [];

        const mineDetection = record.tank.info.stats.mineDetection;
        return this._routeCalc.specialCalculate(
            tankId, from, record.character, this._config,
            mineDetection, exitedOwnMines, isCharge, isZigzag, target,
            this._scene ?? undefined,
        );
    }

    /**
     * 地雷の爆発範囲から緊急脱出するルート計算を依頼し、結果のセル列を返す
     * @param from 出発位置
     * @returns 
     */
    requestEscapeMineRoute(from: THREE.Vector3): Cell[] {
        if (!this._config) return [];
        return this._escapeCalc.calculateMineEscapeRoute(from, this._config);
    }

    /**
     * 反射計算を依頼し、発砲目標位置（ワールド座標）を返す。
     * 個別エネミーAIの砲塔回転判断から呼ばれる。
     * @param selfPos      自タンクの座標
     * @param targetPos    対象（プレイヤー）の座標
     * @param reflectCount 反射回数
     * @param shellRadius  使用する弾の半径（障害物チェックの拡張量）
     */
    requestReflect(
        selfPos: THREE.Vector3,
        targetPos: THREE.Vector3,
        reflectCount: number,
        shellRadius: number,
        totalReflectCount: number = reflectCount,
    ): THREE.Vector3 | null {
        if (!this._config) return null;
        const blocked = this._getOrBuildBlockedGrid();
        return this._reflectCalc.calculate(selfPos, targetPos, reflectCount, this._config, blocked, shellRadius, totalReflectCount);
    }

    /**簡易版の反射計算を依頼し、発砲目標位置（ワールド座標）を返す。
     * 個別エネミーAIの砲塔回転制御から呼ばれる。
     * @param selfPos     自タンクの座標
     * @param targetPos   対象（プレイヤー）の座標
     * @param shellRadius 使用する弾の半径（障害物チェックの拡張量）
     * @returns 発砲目標位置（ワールド座標）
     */
    requestSimpleReflect(
        selfPos: THREE.Vector3,
        targetPos: THREE.Vector3,
        shellRadius: number,
        totalReflectCount: number = 1,
    ): THREE.Vector3 | null {
        if (!this._config) return null;
        const blocked = this._getOrBuildBlockedGrid();
        return this._simpleReflectCalc.calculate(selfPos, targetPos, this._config, blocked, shellRadius, totalReflectCount);
    }

    // ─── 敵 AI 更新 ──────────────────────────────────────────

    /**
     * 個別エネミー AI の update 関数を登録する。
     * StageCreat が Enemy インスタンス生成後に呼ぶ。
     */
    registerEnemyUpdater(fn: (delta: number) => void): void {
        this._updaters.push(fn);
    }

    /** 登録済みの update 関数を削除する。dispose() 時に呼ぶ */
    unregisterEnemyUpdater(fn: (delta: number) => void): void {
        const idx = this._updaters.indexOf(fn);
        if (idx !== -1) this._updaters.splice(idx, 1);
    }

    /**
     * BattleField のアニメーションループから毎フレーム呼ばれる。
     * 登録済み全エネミー AI を更新する。
     */
    update(delta: number): void {
        for (const fn of this._updaters) fn(delta);
    }

    // ─── リセット ─────────────────────────────────────────────

    /** バトル終了時にリセットする。 */
    reset(): void {
        this._config      = null;
        this._scene       = null;
        this._blockedGrid = null;
        this._routeCalc.invalidateGrid();
        this._escapeCalc.invalidateGrid();
        this._enemies.clear();
        this._updaters = [];
    }

    // ─── 内部処理 ─────────────────────────────────────────────

    /**
     * キャッシュ済みグリッドを返す。未構築・無効化済みの場合は再構築する。
     */
    private _getOrBuildBlockedGrid(): boolean[][] {
        if (!this._blockedGrid) {
            this._blockedGrid = this._buildBlockedGrid();
        }
        return this._blockedGrid;
    }

    /**
     * StageObjectManager の全 Cube から shellBlocker セルのグリッドを構築する。
     */
    private _buildBlockedGrid(): boolean[][] {
        const { rows, cols, cellSize } = this._config!;
        const grid = Array.from({ length: rows }, () => new Array<boolean>(cols).fill(false));
        for (const { cube } of StageObjectManager.instance.allCubes) {
            if (!cube.info.stats.shellBlocker) continue;
            const col = Math.floor(cube.object.position.x / cellSize);
            const row = Math.floor(cube.object.position.z / cellSize);
            if (col >= 0 && col < cols && row >= 0 && row < rows) {
                grid[row][col] = true;
            }
        }
        return grid;
    }

}
