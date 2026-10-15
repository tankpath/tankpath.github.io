export interface IEffect {
  // 演出を実行し、終わったらPromiseを返す
  play(changeAction: () => void): Promise<void>;
}