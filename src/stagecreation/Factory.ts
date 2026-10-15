// ここでタンク（敵、味方両方）を生成
import * as THREE from 'three';
import type { GridData, Celltype } from '../Definition/StageDefinition';
import { AssetManager } from '../managers/AssetManager';
import { ENEMY_MODEL_MAP, ENEMY_COLORS, SINGLETON_ENEMY_TYPES } from '../Definition/EnemyDefinition';
import type { EnemyType } from '../Definition/EnemyDefinition';
import { PLAYER_COLORS } from '../Definition/TankDefinition';
import type { TankColors } from '../Definition/TankDefinition';
import type { ShellType } from '../Definition/ShellDefinition';
import type { CubeType } from '../Definition/CubeDefinition';

import type { MineType } from '../Definition/MineDefinition';
import { MINE_STATS } from '../Definition/MineDefinition';
import { Tank } from '../object/tank/Tank';
import { TankInformation } from '../object/tank/TankInfomation';
import { Cube } from '../object/stage_object/Cube';
import { CubeInformation } from '../object/stage_object/CubeInfomation';
import { Mine } from '../object/tank_object/mine/Mine';
import { MineInformation } from '../object/tank_object/mine/MineInformation';
import { StageObjectManager } from '../managers/StageObjectManager';
import { EnemyAnalyzer } from '../Analyze/EnemyAnalyzer';

export interface PlacedTanks {
    player:  Tank | null;
    enemies: Tank[];
}

export class Factory {
    private scene: THREE.Scene;
    private readonly CELL_SIZE  = 1;
    private readonly TANK_SCALE = 1.35;


    constructor(scene: THREE.Scene) {
        this.scene = scene;
    }

    /**
     * @param gridData ステージのグリッドデータ
     * @param playerColors プレイヤータンクの配色。省略時は PLAYER_COLORS.player1（マリオ赤）。
     *                     将来のマルチプレイヤー実装では、プレイヤーが選んだ色をここに渡す。
     */
    placeObjects(gridData: GridData, playerColors?: TankColors): PlacedTanks {
        let player: Tank | null = null;
        const enemies: Tank[] = [];
        let enemyIndex = 0;
        const placedSingletons = new Set<EnemyType>();

        // 全タンクで共有する factory を生成
        const shellFactory = this.createShellFactory();
        const mineFactory  = this.createMineFactory();

        // 分裂弾スポーンのため factory を StageObjectManager に登録
        StageObjectManager.instance.setShellFactory(shellFactory);

        const resolvedPlayerColors = playerColors ?? PLAYER_COLORS.player1;

        gridData.cells.forEach((row, rowIndex) => {
            row.forEach((cell, colIndex) => {
                if (cell === 'player') {
                    const tank = this.createPlayerTank(colIndex, rowIndex, shellFactory, mineFactory, resolvedPlayerColors);
                    if (tank) player = tank;
                } else if (cell === 'enemy') {
                    const tank = this.createEnemyTank(colIndex, rowIndex, gridData.enemyPool, enemyIndex, shellFactory, mineFactory, gridData.forcedEnemyTypes, placedSingletons);
                    if (tank) { enemies.push(tank); enemyIndex++; }
                } else {
                    this.placeStaticObject(cell, colIndex, rowIndex);
                }
            });
        });

        return { player, enemies };
    }

    /**
     * shot.shoot() から呼ばれる弾オブジェクト生成関数を返す。
     * 生成したオブジェクトはシーンに追加済みの状態で返す。
     */
    private createShellFactory(): (bulletType: ShellType) => THREE.Object3D {
        return (bulletType: ShellType) => {
            // 球体を弾として使用。名前を Shell_Core にして ShellEffect が発光・パーティクルを適用できるようにする
            const radius = bulletType === 'ClusterBolt' ? 0.065 : 0.09;
            const mesh = new THREE.Mesh(
                new THREE.SphereGeometry(radius, 16, 16),
                new THREE.MeshStandardMaterial({ color: 0xffffff }),
            );
            mesh.name = 'Shell_Core';
            this.scene.add(mesh);
            return mesh;
        };
    }

    /**
     * MinePlacer から呼ばれる地雷オブジェクト生成関数を返す。
     * ownerTankId はタンク生成時に bind して固定する。
     */
    private createMineFactory(): (mineType: MineType, position: THREE.Vector3, ownerTankId: string) => void {
        return (mineType: MineType, position: THREE.Vector3, ownerTankId: string) => {
            const stats  = MINE_STATS[mineType];
            const object = this.createMineObject(stats.effectColor, stats.bodyColor);
            object.position.set(position.x, 0, position.z);
            this.scene.add(object);

            const mgr  = StageObjectManager.instance;
            const id   = mgr.generateMineId();
            const info = new MineInformation(id, mineType);
            const mine = new Mine(info, object, () => mgr.removeMine(id));

            mgr.registerMine({ id, ownerTankId, mine });
        };
    }

    /**
     * 地雷の 3D オブジェクトを生成する。
     * obj_mine モデルが利用可能ならそれを使い、なければシンプルな円盤で代替する。
     * 返却オブジェクトは y = 0 を前提として配置される。
     */
    private createMineObject(effectColor: number, bodyColor: number): THREE.Object3D {
        const gltf = AssetManager.instance.getModel('obj_mine');

        if (gltf) {
            const model = gltf.scene.clone();

            // セルサイズの 0.4 倍に収まるようにスケール調整
            const box    = new THREE.Box3().setFromObject(model);
            const size   = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.z);
            if (maxDim > 0) {
                model.scale.setScalar((this.CELL_SIZE * 0.4) / maxDim);
            }

            // マテリアル名ごとに着色：Mat_Body → bodyColor、Mat_Warning → effectColor
            model.traverse((child) => {
                if (!(child instanceof THREE.Mesh)) return;
                const tint = (mat: THREE.Material): THREE.Material => {
                    if (!(mat instanceof THREE.MeshStandardMaterial)) return mat;
                    const c = mat.clone() as THREE.MeshStandardMaterial;
                    if (mat.name === 'Mat_Body') {
                        c.color.setHex(bodyColor);
                        c.emissive.setHex(bodyColor);
                        c.emissiveIntensity = 0.4;
                    } else if (mat.name === 'Mat_Warning') {
                        c.color.setHex(effectColor);
                        c.emissive.setHex(effectColor);
                        c.emissiveIntensity = 1.8;
                    }
                    return c;
                };
                child.material = Array.isArray(child.material)
                    ? child.material.map(tint)
                    : tint(child.material);
            });

            return model;
        }

        // フォールバック：光る円盤（モデルが未ロードのとき）
        const fallback = new THREE.Mesh(
            new THREE.CylinderGeometry(0.2, 0.2, 0.06, 12),
            new THREE.MeshStandardMaterial({
                color:             new THREE.Color(effectColor),
                emissive:          new THREE.Color(effectColor),
                emissiveIntensity: 1.8,
            }),
        );
        fallback.position.y = 0.03;  // 円盤を地面の上に置く
        const container = new THREE.Object3D();
        container.add(fallback);
        return container;
    }

    private createPlayerTank(
        col: number, row: number,
        shellFactory: (bulletType: ShellType) => THREE.Object3D,
        mineFactory:  (mineType: MineType, position: THREE.Vector3, ownerTankId: string) => void,
        colors: TankColors,
    ): Tank | null {
        const model = this.placeModel('player', col, row, 0, this.TANK_SCALE);
        if (!model) return null;
        this.applyColors(model, colors);
        return new Tank(new TankInformation('player1', 'player1'), model, shellFactory, mineFactory);
    }

    private createEnemyTank(
        col: number, row: number,
        enemyPool: readonly EnemyType[], index: number,
        shellFactory: (bulletType: ShellType) => THREE.Object3D,
        mineFactory:  (mineType: MineType, position: THREE.Vector3, ownerTankId: string) => void,
        forcedEnemyTypes?: readonly EnemyType[],
        placedSingletons?: Set<EnemyType>,
    ): Tank | null {
        // 強制タイプ（リトライ時）があればそれを使用、なければ重み付き抽選
        const enemyType = forcedEnemyTypes?.[index] ?? EnemyAnalyzer.instance.selectEnemy(enemyPool);

        // シングルトンタイプは1体まで
        if (SINGLETON_ENEMY_TYPES.has(enemyType)) {
            if (placedSingletons?.has(enemyType)) return null;
            placedSingletons?.add(enemyType);
        }
        const modelKey  = ENEMY_MODEL_MAP[enemyType];
        const model     = this.placeModel(modelKey, col, row, 0, this.TANK_SCALE);
        if (!model) return null;
        this.applyEnemyColors(model, enemyType);
        return new Tank(new TankInformation(`enemy_${index}`, enemyType), model, shellFactory, mineFactory);
    }

    private placeStaticObject(cell: Celltype, col: number, row: number): void {
        if (cell !== 'break_wall' && cell !== 'wall' && cell !== 'penetrate_wall') return;

        const cubeType = cell as CubeType;
        const MODEL_KEY: Record<CubeType, string> = {
            wall:            'field_wall',
            break_wall:      'field_breakwall',
            penetrate_wall:  'field_penetratewall',
        };
        const model    = this.placeModel(MODEL_KEY[cubeType], col, row, 0, 1);
        if (!model) return;

        const EMISSIVE: Record<CubeType, number> = {
            wall:           0.3,
            break_wall:     0.3,
            penetrate_wall: 0,
        };
        const emissiveIntensity = EMISSIVE[cubeType];
        model.traverse((child) => {
            if (!(child instanceof THREE.Mesh)) return;
            const apply = (mat: THREE.Material): THREE.Material => {
                if (!(mat instanceof THREE.MeshStandardMaterial)) return mat;
                const m = mat.clone() as THREE.MeshStandardMaterial;
                m.emissive.set(m.color);
                m.emissiveIntensity = emissiveIntensity;
                return m;
            };
            child.material = Array.isArray(child.material)
                ? child.material.map(apply)
                : apply(child.material);
        });

        const mgr  = StageObjectManager.instance;
        const id   = mgr.generateCubeId();
        const info = new CubeInformation(id, cubeType);

        // 非破壊壁はグリッド座標から計算した固定 Box3 を使う。
        // モデルのスケール誤差による壁間の隙間をなくすため。
        const fixedBox = cubeType !== 'break_wall'
            ? new THREE.Box3(
                new THREE.Vector3(col * this.CELL_SIZE,       0,              row * this.CELL_SIZE),
                new THREE.Vector3((col + 1) * this.CELL_SIZE, this.CELL_SIZE, (row + 1) * this.CELL_SIZE),
              )
            : undefined;

        const cube = new Cube(model, info, () => mgr.removeCube(id), fixedBox);
        mgr.registerCube({ id, cube });
    }

    private placeModel(key: string, col: number, row: number, rotationY: number, scaleFactor: number): THREE.Object3D | undefined {
        const gltf = AssetManager.instance.getModel(key);
        if (!gltf) return undefined;
        const model = gltf.scene.clone();

        // マテリアルを個別にクローンしてGLTFソースの共有参照を断ち切る。
        // Three.js の clone() はマテリアルを参照共有するため、エフェクトで
        // opacity 等を書き換えると次回クローン時にも汚染状態が引き継がれる。
        model.traverse(child => {
            if (!(child instanceof THREE.Mesh)) return;
            child.material = Array.isArray(child.material)
                ? child.material.map((m: THREE.Material) => m.clone())
                : child.material.clone();
        });

        // バウンディングボックスでセルサイズ×scaleFactor に収まるようにスケール調整
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        if (maxDim > 0) {
            const scale = (this.CELL_SIZE / maxDim) * scaleFactor;
            model.scale.setScalar(scale);
        }

        // スケール適用後に再計算し、底面(min.y)がy=0に来るようにオフセット
        const scaledBox = new THREE.Box3().setFromObject(model);
        const yOffset = -scaledBox.min.y;

        model.rotation.y = rotationY;
        model.position.set(
            col * this.CELL_SIZE + this.CELL_SIZE / 2,
            yOffset,
            row * this.CELL_SIZE + this.CELL_SIZE / 2
        );
        this.scene.add(model);
        return model;
    }

    private applyColors(model: THREE.Object3D, colors: { main: number; sub: number }): void {
        model.traverse((child) => {
            if (!(child instanceof THREE.Mesh)) return;
            if (Array.isArray(child.material)) {
                child.material = child.material.map(m => this.tintMaterial(m, colors));
            } else {
                child.material = this.tintMaterial(child.material, colors);
            }
        });
    }

    private applyEnemyColors(model: THREE.Object3D, enemyType: EnemyType): void {
        const colors = ENEMY_COLORS[enemyType];
        if (!colors) return;
        this.applyColors(model, colors);
    }

    private tintMaterial(mat: THREE.Material, colors: { main: number; sub: number }): THREE.Material {
        if (!(mat instanceof THREE.MeshStandardMaterial)) return mat;
        const cloned = mat.clone() as THREE.MeshStandardMaterial;
        if (mat.name === 'Mat_Main') cloned.color.setHex(colors.main);
        if (mat.name === 'Mat_Sub')  cloned.color.setHex(colors.sub);
        return cloned;
    }
}
