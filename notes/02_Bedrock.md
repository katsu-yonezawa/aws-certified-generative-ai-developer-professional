# Bedrock

## まず結論

- `Amazon Bedrock` は、複数の基盤モデルを統一 API で使い、RAG、Agents、安全制御、評価、カスタマイズまで含めて GenAI アプリを素早く作るための中核サービス
- AIP-C01 では、`どのモデルを選ぶか`、`どの Bedrock 機能を組み合わせるか`、`どう安全に運用するか` が重要
- `モデルを使う、つなぐ、守る、測る、最適化する` の5視点で覚えると整理しやすい

## Bedrock を 7 層で整理する

| 層 | 何を決めるか | 主な機能 |
| --- | --- | --- |
| モデル層 | どのモデルを使うか | FM、Marketplace、Custom model import |
| 推論層 | どの API で呼ぶか | Responses、Chat Completions、Converse、Invoke |
| プロンプト層 | プロンプトをどう管理するか | Prompt management、Prompt caching |
| 知識拡張層 | 独自データをどう使うか | Knowledge Bases、reranking、structured data |
| 実行制御層 | 推論をどう業務処理へつなぐか | tool use、structured outputs、Agents、Flows |
| 安全・評価層 | 何を防ぎ、何を測るか | Guardrails、Evaluations |
| 運用最適化層 | コスト、性能、運用をどう安定化するか | CountTokens、Batch inference、Provisioned Throughput、Inference Profiles、logging |

## 問題文から決める順番

1. まず `答えるだけ` か `実行まで進む` かを決める
2. 次に `独自知識が必要か` を決める
3. そのうえで `安全制御` と `評価` を足す
4. 最後に `コスト` と `性能` を詰める

要点:

- Bedrock は機能が広いため、下から順に暗記すると混乱しやすい
- 実際は `推論 -> RAG -> ツール実行 -> Guardrails -> 評価 -> 最適化` の順で必要機能を足す方が自然
- 試験でも、この順で切ると `主役機能` と `補助機能` を分けやすい

## 1. モデルを使う

### モデル選択の観点

- モダリティ
  テキスト、画像、埋め込み、マルチモーダル
- 性能
  精度、推論速度、文脈長、tool use 対応
- 運用条件
  利用リージョン、コスト、Provisioned Throughput の要否
- 互換性
  Guardrails、Converse、prompt caching など必要機能と両立するか

### PoC と標準化

- いきなり本番へ進まず、まず `technical proof-of-concept` で実現性、性能、業務価値を確かめる
- PoC では `正答率` だけでなく、`レイテンシ`、`コスト`、`安全制御のかけやすさ`、`運用のしやすさ` を見る
- 共通部品は `プロンプトテンプレート`、`入出力形式`、`Guardrails 方針`、`logging` まで標準化する
- 設計の抜け漏れ確認には `AWS Well-Architected Framework` と `WA Tool Generative AI Lens` が効く

### provider switching と graceful degradation

- プロバイダ差し替えを想定するなら、アプリからモデル固有差分を隠す抽象化層を持つ
- `API Gateway`、`Lambda`、`AppConfig` を組み合わせると、コード変更なしの切り替えをしやすい
- 障害時は `小型モデルへ切替`、`検索結果だけ返す`、`キャッシュ応答へ退避` のような `graceful degradation` を考える
- Bedrock の `Cross-Region inference` は容量や可用性対策になるが、データ所在要件は別に確認する

### Bedrock Marketplace

- Bedrock で利用できるモデル候補を広げる仕組み
- `Amazon提供モデル + サードパーティモデル` のどちらも視野に入る
- 論点は `モデル選択肢の拡張` であり、RAG や Agents の代替ではない

### Custom model import

- 外部で学習・微調整したモデルを Bedrock に取り込んで使う
- 既存の独自モデル資産を活かしたいときの選択肢
- `Bedrock の運用基盤を使いたいが、モデル自体は外で育てた` ときに有効

## 2. 推論を呼ぶ

### API の使い分け

| API | 向く場面 | ざっくり理解 |
| --- | --- | --- |
| `Responses API` | 新規の会話アプリ、OpenAI 互換、サーバー側ツール | 新しく始めるなら有力 |
| `Chat Completions API` | OpenAI 互換コードの移植、会話履歴を自前管理 | 既存資産の移行向け |
| `Converse API` | 複数モデルを統一形式で扱いたい | Bedrock 標準の会話 API |
| `InvokeModel` / `InvokeModelWithResponseStream` | 埋め込み、画像生成、モデル固有パラメータを直接使いたい | 生のモデル呼び出し |

### 覚え方

- 新規チャットアプリ -> `Responses`
- モデル差し替えを前提に統一実装したい -> `Converse`
- OpenAI 互換資産を移したい -> `Chat Completions`
- 埋め込み、画像生成、単発推論 -> `InvokeModel`

## 3. プロンプトを管理する

### Prompt management

- プロンプトを保存する
- 変数を持たせる
- 推論パラメータを含めて管理する
- バージョンを切る
- バリアント比較をしやすくする

### いつ効くか

- 要約、返信、分類など、同じタスクを継続運用するとき
- 開発、検証、本番でプロンプト資産を明確に管理したいとき

### Prompt caching

- 毎回同じ長い前置きや共通コンテキストを送るときに効く
- 長い system prompt や固定参照文書を何度も使うワークロード向け
- 毎回コンテキストが大きく変わるなら効きにくい

## 4. 独自データで答えさせる

### Knowledge Bases

- Bedrock で RAG を構成する中核機能
- データ取り込み、埋め込み、チャンク分割、検索、再ランキングをまとめて扱える
- 非構造データだけでなく、構造化データも扱える

#### 図で見る RAG の実行時フロー

![Amazon Bedrock Knowledge Bases の RAG 実行時フロー](./img/bedrock-kb-rag-runtime.png)

要点:

- `質問を埋め込み化 -> 類似文書を取得 -> 取得文脈で質問を拡張 -> FM が回答` の順で動く
- `最新文書を根拠付きで使いたい` 問題では、この流れを前提に `Knowledge Bases` を第一候補に置く

出典: [AWS 公式図](https://docs.aws.amazon.com/images/bedrock/latest/userguide/images/kb/rag-runtime.png)

### 重要論点

- `chunking`
  小さすぎると文脈不足、大きすぎるとノイズ増加
- `reranking`
  初回検索結果の順位を改善し、関連度を上げる
- `vector store`
  埋め込みを格納して類似検索する基盤
- `multimodal`
  画像を含む知識ソースも扱えるケースがある

### 取り込み前処理

- `Glue Data Quality`
  文書群やメタデータの品質検証に使う
- `Textract`
  PDF や帳票から文字を抽出する
- `Transcribe`
  音声をテキスト化する
- `Lambda` / `Comprehend`
  正規化、エンティティ抽出、不要表現の除去に使う

要点:

- RAG の品質は検索前にかなり決まる
- `汚れた入力のまま埋め込まない` が基本
- Bedrock へ渡す前に、モデルが要求する `JSON` や会話形式へ整形する

### 向く場面

- 社内文書 QA
- 製品マニュアル検索
- FAQ チャット
- 最新文書を参照させたい RAG

### 向かない場面

- 文書検索ではなく、外部 API 実行や業務トランザクション処理が主目的
- 単純な固定ルール処理で検索が不要

### RAG と fine-tuning の違い

- `RAG`
  推論時に外部知識を引く
- `fine-tuning`
  モデルの振る舞いを学習で変える

覚え方:

- 最新知識を使いたい -> `Knowledge Bases`
- 出力形式や口調を変えたい -> `fine-tuning`

### RAG が効く理由

- 学習済み重みを変えず、推論時に最新データを差し込める
- 根拠文書を回答と結び付けやすい
- 文書更新のたびに再学習しなくてよい

補足:

- つまり RAG は `知識更新コスト` と `説明責任` の両方に強い
- 一方で、検索が悪いと回答も悪くなるため、`モデル選び` だけでなく `検索設計` が品質の中心になる

### ベクトルストアと検索設計

- 代表候補は `OpenSearch Service`、`Aurora pgvector`、`Knowledge Bases` のマネージド構成
- メタデータは `作成日時`、`著者`、`部門`、`機密区分`、`ドメインタグ` を持たせる
- 高精度化では `hybrid search`、`reranking`、`query expansion`、`query decomposition` を使い分ける
- ベクトル検索へのアクセス方法は `function calling` や `MCP client` のように統一しておくと差し替えやすい

覚え方:

- まず拾う -> `vector search`
- 次に絞る -> `metadata filtering`
- 最後に順位を上げる -> `reranking`
- 問いをほぐす -> `query expansion / decomposition`

## 5. 業務処理へつなぐ

### tool use

- モデルが外部ツールや API を呼ぶ前提で応答を構成する
- 生成だけで終わらず、`検索、予約、更新、計算` へ進められる

### structured outputs

- JSON などの決まった形式で出力させる
- 後続システムで機械的に処理しやすくする

### Agents

- 会話しながら計画し、必要なツールを選び、タスク完了まで進める
- 外部 API 呼び出しや業務処理を含むエージェント向け
- Lambda や API をアクションとして組み込みやすい

### Flows

- あらかじめ決まった順序で GenAI ワークフローを組む
- 分岐やステップが固定の処理に向く

### Agents と Flows の違い

| 機能 | 向く場面 |
| --- | --- |
| `Agents` | 会話しながら状況に応じてツール選択する |
| `Flows` | 処理順が最初から決まっている |

### 覚え方

- `対話しながら判断` -> `Agents`
- `決まった順序で流す` -> `Flows`
- `まず JSON で安全に渡したい` -> `structured outputs`
- `モデルに API を叩かせたい` -> `tool use`

## 6. 安全に使う

### Guardrails

- 入力と出力の両方に安全制御をかける
- PII 保護
- 禁止トピック制御
- 単語フィルタ
- contextual grounding

### 何に使うか

- ハルシネーション抑制
- 不適切出力の抑止
- 社内ポリシー違反の防止
- 文脈にない回答の抑制

### ApplyGuardrail

- 既存アプリの任意の入出力にも Guardrails を適用できる
- Bedrock 推論 API を直接使わない構成でも安全制御をかけたいときに有効

### 試験での見分け方

- PII を伏せたい
- 禁止話題を止めたい
- 参照文脈に基づく回答だけ許したい

これらが見えたら `Guardrails`

## 7. 品質を測る

### Evaluations

- モデル比較
- プロンプト比較
- RAG 比較
- LLM-as-a-judge
- human-based evaluation

### 使い分け

- `LLM-as-a-judge`
  高速に大量比較したい
- `human-based evaluation`
  ブランド文体、微妙な品質差、主観評価を見たい

### Guardrails との違い

- `Guardrails`
  実行時に防ぐ
- `Evaluations`
  実験・検証時に測る

## 8. モデルをカスタマイズする

### まず切り分け

- 知識を追加したいのか
- 出力形式を整えたいのか
- 小さいモデルへ能力を移したいのか
- 評価基準に沿って磨きたいのか

### 手法の比較

| 手法 | 何を与えるか | 何を変えるか | 向く場面 |
| --- | --- | --- | --- |
| `Fine-tuning` | 入力と望ましい出力のペア | 応答形式、口調、分類、JSON 出力 | 定型応答、形式固定 |
| `Continued pre-training` | ラベルなし文書 | ドメイン知識、専門用語、文体 | 専門分野適応 |
| `Distillation` | 教師モデルへ投げるプロンプト群 | 高性能モデルの振る舞いを小型モデルへ移す | 品質を保って高速化・低コスト化 |
| `Reinforcement fine-tuning` | プロンプトと報酬関数 | 採点基準に沿って答え方を磨く | コード生成、SQL、要約、RAG忠実性 |

### PEFT とライフサイクル

- `LoRA` や `adapters` は、差分だけを持つ `parameter-efficient adaptation` として出やすい
- 低コストで調整したい、複数バリアントを持ちたい、更新を速く回したい場面で有効
- カスタムモデルは `versioning`、`approval`、`rollback`、`retire / replace` まで含めて覚える
- 学習方法の比較だけで終わらず、`本番更新で安全に戻せるか` まで見る

### 覚え方

- 文書だけある -> `Continued pre-training`
- 正解例がある -> `Fine-tuning`
- 教師モデルを使いたい -> `Distillation`
- 正解文より採点関数を作りやすい -> `Reinforcement fine-tuning`

### カスタマイズ前に止まって考えること

1. その課題は検索で解けないか
2. schema や tool use で解けないか
3. 評価基準は定義できているか
4. 本番更新時に rollback できるか

要点:

- カスタマイズは強力だが、`一度作れば終わり` ではない
- 版管理、評価、承認、rollback まで考えないと、本番では扱いづらい
- 試験では `fine-tuning したい` という願望より、`本当に必要か` を切る方が重要

## 9. コストと性能を最適化する

### CountTokens

- プロンプトや入力のトークン量を事前に見積もる
- コスト見積もり、上限管理、長文抑制に使う

### Batch inference

- 大量データをまとめて非リアルタイム処理する
- 夜間一括要約、レビュー分類、議事録処理に向く

### Provisioned Throughput

- 安定スループットや予測可能な本番性能が必要なときの選択肢
- 大規模本番や厳しいレイテンシ要件向け

### Inference Profiles

- アプリケーション単位のトラフィック管理や可観測性に使う
- クロスリージョン推論の論点ともつながる

### Cross-Region inference

- 利用可能リージョンや容量をまたいで推論する考え方
- レジリエンスや容量確保に効くが、データ所在要件には注意

### 覚え方

- トークン数を事前把握 -> `CountTokens`
- 一括処理 -> `Batch inference`
- 安定性能が必要 -> `Provisioned Throughput`
- アプリ別に追跡・管理 -> `Inference Profiles`

## 10. セキュリティ、監査、監視

### セキュリティ

- IAM による最小権限
- KMS による暗号化
- VPC エンドポイント / PrivateLink によるプライベート接続
- データ保護とリージョン要件の確認

### 監査

- `model invocation logging`
  推論入力 / 出力の監査や再現調査に使う
- `CloudTrail`
  API 操作の追跡
- `EventBridge`
  イベント駆動の通知や自動処理

### 監視

- `CloudWatch`
  レイテンシ、エラー、スロットル、利用量の監視

### 試験での見分け方

- プライベート接続 -> `PrivateLink`
- 呼び出し履歴の追跡 -> `CloudTrail`
- 推論内容の監査 -> `invocation logging`
- レイテンシやエラー率監視 -> `CloudWatch`

## 11. Bedrock Data Automation

- 非構造データを構造化データへ変換するための機能
- 文書、画像、音声、動画などから、後続処理しやすい情報を抽出する

### Knowledge Bases との違い

- `Knowledge Bases`
  検索して回答するためのRAG基盤
- `Bedrock Data Automation`
  非構造データを抽出・変換して使いやすくする

## 12. よくあるユースケース

### 社内ドキュメント検索チャット

- 第一候補: `Knowledge Bases + Converse/Responses + Guardrails`
- fine-tuning より RAG が自然

### 予約や申請を処理する業務エージェント

- 第一候補: `Agents + tool use + Lambda/API + Guardrails`

### 固定手順の文書処理フロー

- 第一候補: `Flows + structured outputs`

### 大量データの夜間一括処理

- 第一候補: `Batch inference`

### 長い共通コンテキストを何度も使うアシスタント

- 第一候補: `Prompt caching`

### 厳密な JSON 抽出

- 第一候補: `structured outputs`

## 理解を深める補足

### Bedrock を1本の流れで見る

1. モデルを選ぶ
2. API で呼ぶ
3. 必要なら知識を足す
4. 必要ならツール実行へつなぐ
5. Guardrails で守る
6. Evaluations で比較する
7. 最適化と監視を足す

補足:

- この流れで見ると、各機能が `前の弱点を補うためにある` と分かる
- 例えば `Knowledge Bases` は最新知識不足を補い、`structured outputs` は自由文の不安定さを補い、`Guardrails` は本番運用の危険を補う
- 単語の暗記より `なぜその機能が必要になるか` を追うと、比較問題に強くなる

## 13. 混同しやすい論点

| 論点 | 違い |
| --- | --- |
| `RAG` vs `fine-tuning` | 外部知識を引くか、モデル自体を学習で変えるか |
| `Knowledge Bases` vs `Agents` | 検索して答えるか、ツール実行まで進むか |
| `Agents` vs `Flows` | 状況に応じて判断するか、順序が固定か |
| `Guardrails` vs `Evaluations` | 実行時に防ぐか、事前に測るか |
| `Prompt caching` vs `fine-tuning` | 入力コスト最適化か、モデル挙動変更か |
| `Batch inference` vs `Provisioned Throughput` | 一括処理か、常時性能保証か |
| `provider switching` vs `model routing` | プロバイダ差し替え前提か、問い合わせごとの最適ルーティングか |

## 14. 試験での判断フロー

1. まず目的を切る
   `推論 / 検索 / ツール実行 / 安全制御 / 評価 / カスタマイズ / 最適化`
2. モデル選定前に確認する
   `PoC / 標準化 / provider switching / graceful degradation`
3. 独自知識が必要なら切る
   `Knowledge Bases` か `fine-tuning` か
4. 実行制御が必要なら切る
   `structured outputs / tool use / Agents / Flows`
5. 安全性が必要なら切る
   `Guardrails / IAM / PrivateLink / logging`
6. コストと性能を切る
   `CountTokens / Prompt caching / Batch / Provisioned Throughput / Inference Profiles`

## Active Recall

- Responses、Chat Completions、Converse、InvokeModel はどう使い分けるか
- Prompt management と Prompt caching は何が違うか
- `technical proof-of-concept` で何を確認するか
- provider switching と graceful degradation は何が違うか
- Knowledge Bases で重要な設計要素は何か
- RAG 取り込み前処理で何を見るか
- tool use、structured outputs、Agents、Flows はどう違うか
- Guardrails で何を制御できるか
- Evaluations と Guardrails の違いは何か
- Fine-tuning、Continued pre-training、Distillation、Reinforcement fine-tuning はどう切り分けるか
- `LoRA` / `adapters` はどんな狙いで使うか
- CountTokens、Batch inference、Provisioned Throughput、Inference Profiles はどの要件で使うか
- PrivateLink、CloudTrail、invocation logging、CloudWatch は何を守り、何を観測するか
- Bedrock Data Automation と Knowledge Bases の違いは何か

### 答えと解説

1. `Responses` は新規会話アプリ、`Chat Completions` は OpenAI 互換コードの移植、`Converse` は複数モデルを統一形式で扱う用途、`InvokeModel` は埋め込みや画像生成などの直接呼び出しに向きます。新規か移植か、統一化か生の制御かで切り分けます。
2. `Prompt management` はプロンプトを保存、変数化、版管理する機能で、`Prompt caching` は同じ長い前置きや共通コンテキストを再利用してコストやレイテンシを下げる機能です。前者は運用資産化、後者は推論最適化です。
3. `technical proof-of-concept` では、実現性、レイテンシ、コスト、安全制御、業務価値を確認します。正答率だけで本番判断しないことが重要です。
4. `provider switching` はモデル提供元を差し替えやすくする設計で、`graceful degradation` は障害時に品質を少し落としてでも止めない設計です。前者は柔軟性、後者は可用性の論点です。
5. Knowledge Bases では、チャンク分割、埋め込み、ベクトル検索、再ランキング、データソース設計が重要です。検索精度は `何をどう分割し、どう再順位付けするか` に強く依存します。
6. 取り込み前処理では、文書品質、OCR や音声文字起こしの精度、メタデータ、モデルが要求する入力形式を見ます。RAG は検索前の整形で大きく差がつきます。
7. `tool use` は外部 API 実行、`structured outputs` は JSON などの決まった形式出力、`Agents` は状況に応じた計画とツール選択、`Flows` は固定手順のワークフローです。自由度が高いほど `Agents` 寄り、手順固定なら `Flows` 寄りです。
8. Guardrails では、PII 保護、禁止トピック、単語フィルタ、contextual grounding などを制御できます。入力と出力の両方に安全策をかけるのが要点です。
9. `Evaluations` は事前に品質を測る仕組みで、`Guardrails` は実行時に危険な入出力を防ぐ仕組みです。測る機能か、防ぐ機能かを混同しないことが重要です。
10. `Fine-tuning` は正解ペアで出力形式や口調を整え、`Continued pre-training` はラベルなし文書でドメイン知識を厚くし、`Distillation` は教師モデルの振る舞いを小型モデルへ移し、`Reinforcement fine-tuning` は報酬関数で答え方を磨きます。`何を与えるか` で見分けると整理しやすいです。
11. `LoRA` や `adapters` は、差分だけで効率よく適応するための手法です。更新コストを抑えつつ、複数用途向けバリアントを持ちたいときに向きます。
12. `CountTokens` は事前見積もり、`Batch inference` は大量の非リアルタイム処理、`Provisioned Throughput` は安定性能の確保、`Inference Profiles` はアプリ単位のトラフィック管理や可観測性で使います。要件がコスト見積もりか、一括処理か、性能保証か、運用管理かで選びます。
13. `PrivateLink` はプライベート接続を守り、`CloudTrail` は API 操作を追跡し、`invocation logging` は推論入出力の監査に使い、`CloudWatch` はレイテンシやエラー率などの運用メトリクスを監視します。ネットワーク、監査証跡、内容監査、性能監視の役割分担です。
14. `Knowledge Bases` は検索して回答する RAG 基盤で、`Bedrock Data Automation` は文書、画像、音声、動画などの非構造データを抽出・構造化する機能です。前者は答えるための検索基盤、後者は使いやすいデータへ変換する前処理基盤です。

## 公式情報

- [What is Amazon Bedrock?](https://docs.aws.amazon.com/bedrock/latest/userguide/what-is-bedrock.html)
- [Supported foundation models in Amazon Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/models-supported.html)
- [Inference request flow and APIs for Amazon Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/inference-api.html)
- [AWS Well-Architected Framework](https://docs.aws.amazon.com/wellarchitected/latest/framework/welcome.html)
- [Generative AI Lens](https://docs.aws.amazon.com/wellarchitected/latest/generative-ai-lens/generative-ai-lens.html)
- [Prompt management in Amazon Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-management.html)
- [Knowledge Bases for Amazon Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/knowledge-base.html)
- [What is Amazon OpenSearch Service?](https://docs.aws.amazon.com/opensearch-service/latest/developerguide/what-is.html)
- [Using the pgvector extension with Amazon Aurora PostgreSQL](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/AuroraPostgreSQL.VectorDB.html)
- [Agents for Amazon Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/agents.html)
- [Amazon Bedrock Flows](https://docs.aws.amazon.com/bedrock/latest/userguide/flows.html)
- [Guardrails for Amazon Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails.html)
- [Model evaluation in Amazon Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/model-evaluation.html)
- [Customize models in Amazon Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/custom-models.html)
- [Continued pre-training in Amazon Nova](https://docs.aws.amazon.com/nova/latest/userguide/nova-cpt.html)
- [Distillation in Amazon Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/model-distillation.html)
- [Reinforcement fine-tuning in Amazon Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/reinforcement-fine-tuning.html)
- [Optimize costs using prompt caching in Amazon Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-caching.html)
- [Batch inference in Amazon Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/batch-inference.html)
- [Provisioned Throughput for Amazon Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/prov-throughput.html)
- [Use inference profiles in Amazon Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/inference-profiles.html)
- [Monitor Amazon Bedrock using CloudWatch](https://docs.aws.amazon.com/bedrock/latest/userguide/monitoring.html)
- [Logging Amazon Bedrock API calls using AWS CloudTrail](https://docs.aws.amazon.com/bedrock/latest/userguide/logging-using-cloudtrail.html)
- [Monitoring model invocation using logs](https://docs.aws.amazon.com/bedrock/latest/userguide/model-invocation-logging.html)
- [Use AWS PrivateLink to set up private access to Amazon Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/vpc-interface-endpoints.html)
- [Amazon Bedrock Data Automation](https://docs.aws.amazon.com/bedrock/latest/userguide/bda.html)
- [Amazon Bedrock Marketplace](https://docs.aws.amazon.com/bedrock/latest/userguide/bedrock-marketplace.html)
- [AWS Glue Data Quality](https://docs.aws.amazon.com/glue/latest/dg/glue-data-quality.html)
- [Amazon Textract](https://docs.aws.amazon.com/textract/latest/dg/what-is.html)
- [Amazon Transcribe](https://docs.aws.amazon.com/transcribe/latest/dg/what-is.html)
