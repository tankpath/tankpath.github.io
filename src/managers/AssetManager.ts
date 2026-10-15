import { GLTFLoader, type GLTF } from "three/examples/jsm/Addons.js";

export class AssetManager {
    private static _instance: AssetManager;
    private models: Map<string, GLTF> = new Map();
    private jsonData: Map<string, any> = new Map();
    private loader = new GLTFLoader();

    static get instance() {
        if (!this._instance) this._instance = new AssetManager();
        return this._instance;
    }

    async loadModel(key: string, url: string, onProgress?: (pct: number) => void): Promise<void> {
        return new Promise((resolve, reject) => {
            this.loader.load(
                url,
                (gltf) => {
                    this.models.set(key, gltf);
                    resolve();
                },
                (xhr) => {
                    if (xhr.lengthComputable && onProgress) {
                        onProgress((xhr.loaded / xhr.total) * 100);
                    }
                },
                (err) => reject(err)
            );
        });
    }

    getModel (key: string) {
        return this.models.get(key);
    }

    async loadJson(key: string, url: string): Promise<void> {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to load JSON: ${url}`);
        const data = await response.json();
        this.jsonData.set(key, data);
    }

    getJson(key: string) {
        return this.jsonData.get(key);
    }

    async loadAll(assets: {key: string, url: string }[], onTotalProgress?: (pct: number) => void): Promise<void> {
        const total = assets.length;
        let loadedCount = 0;

        const promiss = assets.map(async (asset) => {
            if (asset.url.endsWith('.json')) {
                await this.loadJson(asset.key, asset.url);
            } else {
                await this.loadModel(asset.key, asset.url);
            }
            loadedCount++;
            if (onTotalProgress) {
                onTotalProgress((loadedCount / total) * 100);
            }
        });

        await Promise.all(promiss);
    }
}