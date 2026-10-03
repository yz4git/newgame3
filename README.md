# NOVA STRIKE

星核を取り戻せ。スマホとPCで遊べる、オリジナルの縦スクロールシューティング。

**Play:** https://yz4git.github.io/newgame3/

高速編隊戦、武器の段階強化、地上目標、秘密のコア、編隊全滅ボーナスを軸にしたアーケード作品です。Star Soldier系のテンポと攻略性を参考に、機体・敵・音楽・背景・ステージを新規に制作しています。

- **Campaign:** 軌道都市 → 結晶宙域 → 機械星。3つのセクターと、部位破壊・3種類の攻撃を持つ巨大ボス。
- **Caravan:** 120秒のスコアアタック。モード・難易度別に端末へハイスコア保存。
- **3武器:** 広範囲WIDE / 正面火力・貫通LASER / 追尾HOMING。4段階強化と最高レベルの補助機。
- **NOVA:** 弾消し・全体攻撃・一時無敵。ゲージ満タン時はボムを消費せず6秒間OVERDRIVE。
- **攻略:** 最大8倍の連続撃破、編隊全滅、接近撃破、弾のかすり、秘密の地上コア。
- **復帰:** 被弾後の無敵・周囲の弾消し・回復用パワーアップ。セクタークリアで耐久とボム補給。
- **PWA:** ホーム画面追加、初回読み込み後のオフライン起動。ファイル名のハッシュとバージョン別キャッシュで更新に対応。

## 操作

| 操作 | スマホ | PC / ゲームパッド |
|---|---|---|
| 移動・自動射撃 | 画面をドラッグ | 矢印 / WASD・左スティック / 十字キー |
| 武器切替 | 左下のWEAPON | C / Xボタン |
| NOVA | 右下 | Space / Xキー・Bボタン |
| 精密移動・集中射撃 | FOCUS長押し | Shift / Aボタン |
| 一時停止 | 右上のⅡ | Esc / P・Start |

iPhoneでは縦画面推奨。移動とNOVA / FOCUSの同時入力に対応。記録はブラウザ・端末単位で保存します。

## 開発

Node.js 24以上を推奨。

```bash
npm ci
npm run dev
npm run check
npm test
npm run build
```

TypeScript / Vite / three.js r186。WebGPURenderer + TSLのブルーム、WebGL 2バックエンドと起動失敗時の標準レンダラーへのフォールバック。60 Hzの固定ステップ戦闘、シード付き編隊、移動線分による衝突判定、弾・破片のインスタンシング、端末負荷に応じた解像度調整、Web AudioによるBGM / SE。

`app/`が編集用ソース、`public/`がPWA資産です。`npm run build`がルートの`index.html`、`assets/`、`sw.js`を生成します。生成済みファイルとソースを一緒にコミットしてください。実行時CDNは不要です。

`.github/workflows/pages.yml`が`main`の公開用ファイルをGitHub Pagesへデプロイします。GitHub PagesのSourceは**GitHub Actions**を使用します。手動のブランチ公開を使う場合は**main / root**でも動作します。

`?renderer=webgl`でWebGL 2を明示できます。テスト用の状態は`window.__nova.snapshot()`、戦闘本体は`window.__nova.game`から確認できます。

## 確認項目

- `npm run check`: TypeScript型チェック
- `npm test`: 高速弾の衝突、NOVAでの緊急回避、被弾復帰、ポーズ、シード再現性、通常射撃で全3ボス撃破、Caravan終了時間
- ブラウザ: スマホサイズでの表示、移動とNOVAの同時操作、フォーカス、武器切替、ポーズ復帰、画面遷移、描画エラー、オフライン起動

## 権利・参照

既存作品の画像・機体・キャラクター・音楽・ステージデータは使用していません。3Dモデルは手続き的ジオメトリ、音は独自のWeb Audio合成です。

three.jsなどの依存ライブラリのライセンスは`THIRD_PARTY_NOTICES.md`をご覧ください。

ゲーム設計では`yz4git/game-core`のShooter Recovery & Encounters、Touch & Controller Ergonomicsを参照しています。
