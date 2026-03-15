# AWS Certified Generative AI Developer - Professional

## 改訂版オリジナルテキスト

AIP-C01 対応 / Amazon Bedrock 中心 / 事実関係を見直した完全版

**最終確認日:** 2026-03-15

> **この版の前提**
> 本資料は、試験対策として理解の流れを重視しつつ、事実関係の誤りを修正した改訂版です。
> Amazon Bedrock、Guardrails、Flows、AgentCore、S3 Vectors などは更新が早いため、モデル対応、リージョン対応、Preview 可否は本番設計時に一次資料で再確認してください。
> とくにプレビュー機能、モデル固有の制約、リージョン差分、料金・クォータは変化しやすい領域です。

改訂の中心: Action group の定義方法 / Prompt caching TTL / Model invocation logging の扱い / Guardrails enforcements / Generative AI Lens の日付表現

# 目次

- 1. 生成AIの基礎と Amazon Bedrock でやること
- 2. ベクトル保管場所と正確さの考え方
- 3. データを扱いやすい形にして流す
- 4. エージェントと運用基盤
- 5. 運用の効率化
- 6. プロンプト管理と Flows
- 7. ガバナンス・品質評価・安全対策
- 付録 A. 今回の改訂で直した重要点
- 付録 B. 主要な一次資料

> **読み方**
> 本資料は、暗記用の断片集ではなく、設計判断の筋道が見えるように章をつないでいます。
> 試験では、単独機能の知識よりも、要件に対してどの機能を選ぶか、何を避けるか、どう切り分けるかが問われやすいと考えると整理しやすくなります。

# 1. 生成AIの基礎と Amazon Bedrock でやること

この章では、生成AIの基本動作、Amazon Bedrock の役割、RAG、Knowledge Bases、Guardrails、Prompt management、Flows、Agents までを一続きの流れとして整理します。ここがつながると、後の章の選択問題がかなり読みやすくなります。

## 1-1. 生成AIの基本は、次に出すトークンを選び続けること

大規模言語モデルは、入力の続きを作るときに、次に出すトークンの確率分布を計算し、その中から候補を選び続けます。このため、同じ問いでも毎回まったく同じ結果になるとは限りません。

- 入力が長くなるほど、処理量と費用は増えやすい。
- 出力もトークンで数えられるため、長い回答はコストとクォータの両方に影響する。
- 実務では、必要な文脈だけを渡す、古い会話は要約する、出力長を制御する、といった工夫が重要になる。

## 1-2. 基盤モデル、ベースモデル、推論

広いデータで事前学習済みの大規模モデルを基盤モデルと呼びます。Bedrock の文脈では、提供されている元のモデルをベースモデルと呼び、そのモデルを呼び出して応答を得ることを推論と呼びます。

試験では、まずベースモデルをそのまま使い、プロンプト設計と推論パラメータで性能を引き出す発想が基本です。いきなり学習系の施策に飛ばず、まずは推論時の工夫、次に RAG、その後に微調整や継続事前学習を考える順序で整理すると迷いにくくなります。

## 1-3. 推論パラメータは、長さとぶれを制御するつまみ

代表的な推論パラメータは温度、topP、topK、停止シーケンス、最大トークン数です。意味は共通していますが、使える項目、許容範囲、既定値はモデルによって異なります。

- 温度: 小さいほど安定寄り、大きいほど多様性寄り。
- topP / topK: 候補集合を絞るための仕組み。
- max_tokens: 出力の上限長を決める値。必要以上に大きいとスループットを落としやすい。
- stop sequences: 特定の文字列に達したら生成を止めたい場合に使う。

## 1-4. Amazon Bedrock の位置づけ

Amazon Bedrock は、複数の基盤モデルを単一のサービスとして使えるマネージド基盤で、推論、Knowledge Bases、Guardrails、Prompt management、Flows、Agents などをまとめて提供します。

データ保護の理解は重要です。Bedrock 自体は、既定ではプロンプトや補完結果を保存・ログ化せず、AWS のモデル学習にも使いません。ただし、利用者が model invocation logging を有効化すると、入力や出力を CloudWatch Logs や Amazon S3 に配信できます。つまり、既定動作と利用者が有効化するログ機能は分けて理解する必要があります。

## 1-5. モデル利用の前提条件とアクセス

モデル利用の条件は、単純に一律ではありません。商用リージョンでは、AWS Marketplace 権限を前提に自動利用できるモデルもありますが、モデル提供元によっては追加条件があります。

- Anthropic 系モデルでは、初回にユースケース情報の提出が必要な場合がある。
- 利用許諾やサブスクリプション、Marketplace 側の権限が前提になるケースがある。
- 試験では、モデルごとに前提条件が違う、という整理を持っておくと安全。

## 1-6. API の切り分け

覚え方はシンプルで、推論は runtime、作成や設定は build-time または control plane です。

| **領域**              | **主な用途**                            | **代表例**                                     |
|-----------------------|-----------------------------------------|------------------------------------------------|
| bedrock               | モデル・カスタマイズ・各種管理          | ListFoundationModels など                      |
| bedrock-runtime       | モデル推論                              | InvokeModel / Converse / CountTokens           |
| bedrock-agent         | Agents / Knowledge Bases / Flows の構築 | CreateAgent / CreateFlow                       |
| bedrock-agent-runtime | Agents / Flows / KB の実行              | InvokeAgent / InvokeFlow / RetrieveAndGenerate |

## 1-7. Converse と InvokeModel の違い

InvokeModel はモデル固有の入出力形式を使う低レベル寄りの呼び出しです。一方 Converse は、メッセージ形式に統一された共通インターフェースで、会話型アプリケーションを組みやすく、モデル差し替えもしやすいのが利点です。

AIP-C01 では、会話アプリ、Prompt management、ツール利用、ガードレール統合の観点から Converse を中心に理解しておくと得点しやすくなります。

## 1-8. 社内情報を反映したいときは、まず RAG を考える

基盤モデルは一般知識には強い一方で、社内文書や最新の業務ルールは持っていないことがあります。こうした情報を検索してから回答生成へ渡す考え方が RAG です。

Knowledge Bases は、この RAG を Bedrock 上で構成するための機能です。データソースを同期し、埋め込みをベクトルストアへ保存し、検索結果を使って回答と引用を生成します。

1. ベクトルストアを用意する。OpenSearch Serverless を自動作成させる構成も選べる。
2. データソースを接続する。
3. 同期して取り込む。
4. アプリやエージェントから、検索だけ、または検索＋回答生成を呼び出す。

## 1-9. 埋め込み、ベクトルストア、チャンク分割

埋め込みは、テキストや画像を意味比較しやすい数値列に変換したものです。Knowledge Bases では、この埋め込み、分割済みテキスト、メタデータをベクトルストアに保持します。

検索品質は、埋め込みモデルだけでなく、チャンク分割とメタデータ設計の影響を強く受けます。固定長でまず動かし、必要に応じて階層型や意味ベース、さらに Lambda による独自前処理へ進むのが実務では扱いやすい流れです。

- OpenSearch Serverless と OpenSearch Managed clusters は、Knowledge Bases でバイナリベクトルを扱えるベクトルストア。
- OpenSearch Managed clusters を使う場合は、Knowledge Bases 側のサポート条件を必ず確認する。公開アクセスが必要などの制約がある。
- メタデータは、絞り込みだけでなく、出典説明や再ランキングにも効く。

## 1-10. カスタマイズ手段の選び方

試験では、要件に応じて最初に選ぶ手段を問われやすいです。出力の形や口調をそろえたいだけならプロンプト調整、最新情報や社内情報を根拠付きで答えたいなら RAG、分類の癖や専門用語の一貫性までモデル側へ寄せたいなら微調整や継続事前学習を検討します。

| **手段**              | **主に変わるもの** | **向いている要件**                         |
|-----------------------|--------------------|--------------------------------------------|
| プロンプト調整        | 指示と出力形式     | 口調、書式、判断手順をそろえたい           |
| RAG / Knowledge Bases | 参照できる情報     | 社内文書や最新情報を根拠付きで使いたい     |
| 微調整                | モデルの振る舞い   | 分類、専門用語、定型応答を強く安定させたい |
| 継続事前学習          | ドメイン慣れ       | ある種類の文体や知識へ広く寄せたい         |

## 1-11. Guardrails は、モデル横断で安全策を当てる部品

Bedrock Guardrails は、入力と出力の両方に適用できる安全レイヤーです。コンテンツフィルタ、denied topics、word filters、sensitive information filters、contextual grounding checks、automated reasoning checks などを組み合わせられます。

- contextual grounding checks は、参照ソースとユーザー質問がある前提で、要約、言い換え、質問応答に向く。Conversational QA / chatbot 用途はサポート対象外。
- automated reasoning checks は、ルールに対する論理検証に向くが、これだけで prompt injection を防ぐ前提にはしない。
- prompt attack detection などの安全機能も、他の制御と合わせて多層化する。

## 1-12. Prompt management、Flows、Agents をどうつなぐか

Prompt management は、よく使う指示文を保存し、変数を埋め込み、バリアント比較と版管理をする仕組みです。Flows は、プロンプト、Knowledge Bases、Lambda、条件分岐などをつないだ決め打ち寄りのワークフローです。Agents は、会話の中で必要な知識や道具を選びながら進める仕組みです。

整理すると、指示文の資産化は Prompt management、手順が決まる処理は Flows、状況依存の道具選択や聞き返しが必要なら Agents、という切り分けが基本です。

> **この章の試験ポイント**
> Converse と InvokeModel の違いを、入力形式と用途の観点で説明できること。
> Knowledge Bases の流れを、取り込み → 検索 → 回答生成で説明できること。
> Guardrails を、何を守る仕組みかで言い分けられること。

# 2. ベクトル保管場所と正確さの考え方

この章では、OpenSearch と S3 Vectors を中心に、ベクトル検索の仕組みと、検索品質をどう考えるかを整理します。単に保存先の違いとして覚えるのではなく、取りこぼし、混ざりすぎ、速度、フィルタの効き方まで含めて判断できる状態を目指します。

## 2-1. ベクトル検索の基本

セマンティック検索では、文書や画像を埋め込みへ変換し、クエリの埋め込みと距離が近いものを探します。キーワード一致だけでは拾いにくい意味的な近さを扱えるのが利点です。

一方で、検索品質は埋め込みモデルだけでは決まりません。チャンクの作り方、メタデータ、フィルタ、再ランキング、最後の回答生成まで含めて設計する必要があります。

## 2-2. OpenSearch をベクトルストアとして使うときの考え方

Amazon OpenSearch Service では knn_vector フィールドを使ってベクトル検索を行います。OpenSearch はベクトル次元数、距離関数、近似探索アルゴリズム、フィルタ方法の選択肢が広く、低遅延・高スループット・ハイブリッド検索・集計まで含めて考えやすいのが強みです。

- 近似最近傍探索は、速度やメモリ効率の代わりに、検索精度を少し犠牲にする。
- HNSW は代表的な近似探索方式で、ef_construction や m の調整がインデックス構築コストと検索品質に影響する。
- 厳密な前処理フィルタが強い要件なら、近似探索だけでなく exact search 系も検討する。

## 2-3. フィルタのかけ方で結果数と再現率が変わる

OpenSearch の k-NN 検索では、フィルタをいつ適用するかで結果が変わります。post_filter のように後から絞る方法では、k 件より少ない結果しか返らないことがあります。

一方で、効率的な k-NN フィルタリングは検索中にフィルタを反映し、条件に合う候補をより取りやすくします。ここは、速度と recall の両方に効く試験ポイントです。

- 後段フィルタは、取りこぼしが増えやすい。
- 検索中フィルタは、適切に使うと k 件を満たしやすい。
- 強いフィルタ条件を前提にする設計では、exact search や別の保存先の方が自然なこともある。

## 2-4. S3 Vectors の位置づけ

S3 Vectors は、Amazon S3 に近い発想で使えるベクトル専用ストレージです。ベクトルバケットとベクトルインデックスを持ち、インフラを自前で管理せずに保存・取得・検索を行えます。

特徴は、書き込みの強い整合性、運用の軽さ、低頻度クエリ向けのコスト効率です。一方で、OpenSearch のようなハイブリッド検索、集計、検索結果の複雑な分析を主眼に置く場合は、OpenSearch の方が自然です。

- 低頻度検索ならサブ秒応答、頻度が上がると 100ms 級も狙える設計。
- 書き込みは強い整合性で、追加直後に読める。
- 自動最適化により、更新や削除を繰り返しても価格と性能のバランスを取りやすい。

## 2-5. S3 Vectors で押さえるべき制約

| **項目**                         | **代表的な上限・性質** | **見方**                             |
|----------------------------------|------------------------|--------------------------------------|
| 次元数                           | 1〜4096                | 埋め込みモデルと一致が必要           |
| QueryVectors の topK             | 最大 100               | 大量候補の再ランキングには工夫が要る |
| PutVectors                       | 1 回あたり最大 500     | バッチ投入単位を設計する             |
| 1 インデックスあたりのベクトル数 | 最大 20 億             | 大規模保存向け                       |
| 1 バケットあたりのインデックス数 | 最大 10,000            | 用途分割しやすい                     |

## 2-6. S3 Vectors のメタデータ設計

S3 Vectors は、検索とフィルタ判定を同時に行う設計を持ち、条件に合う結果を見つけやすいのが特徴です。メタデータは既定で filterable ですが、明示的に non-filterable として作ることもできます。

- filterable metadata は検索条件に使えるが、サイズ制限が厳しい。
- non-filterable metadata は条件には使えないが、大きめの文脈を返り値に持たせやすい。
- non-filterable として作ったキーは、後から filterable に戻せない。

## 2-7. Knowledge Bases と組み合わせるときの見方

Knowledge Bases の保存先として S3 Vectors を選ぶと、低コストで大規模な保存に向きます。ただし、S3 Vectors をベクトルストアにした Knowledge Bases では、セマンティック検索中心の前提で考えるのが安全です。

OpenSearch を選ぶと、ハイブリッド検索、集計、より高度な検索体験へつなげやすくなります。検索要件が複雑になるほど OpenSearch、保存コストと運用の軽さを重視するほど S3 Vectors という見方が基本です。

## 2-8. 正確さは、検索段階と生成段階に分けて考える

RAG の正確さを考えるときは、検索段階と生成段階を分けて見るのが大切です。検索段階では、欲しい根拠を取りこぼさないことと、関係ない根拠を混ぜすぎないことの両立が課題です。生成段階では、最終回答が正しいか、根拠から外れていないかを見ます。

- 検索段階: recall、precision、フィルタの影響、チャンク設計、topK、再ランキング。
- 生成段階: correctness、completeness、faithfulness、citation precision / coverage。
- 改善は、埋め込みモデル変更だけではなく、メタデータ、フィルタ、topK、再ランキング、評価データの見直しで進める。

> **この章の試験ポイント**
> OpenSearch は検索機能の豊富さ、S3 Vectors は低コストかつ運用の軽さが軸です。
> フィルタをどこで効かせるかで、返せる件数と取りこぼしが変わります。
> 正確さは、検索の品質と最終回答の品質を分けて評価します。

# 3. データを扱いやすい形にして流す

AIP-C01 では、基盤モデルに渡すためのデータ検証と処理パイプラインを設計・実装する力が問われます。ここでは、構造化、半構造化、非構造化、更新追随、監視までを一続きの運用として整理します。

## 3-1. データの形を見分ける

構造化データは、列と型が明確なテーブル中心のデータです。半構造化データは JSON やタグ付き文書のように、項目名やラベルが手がかりになるものです。非構造化データは PDF、Office 文書、画像、音声、動画など、まず中身を取り出して整理する必要があるものです。

- 構造化: 列と型を保ちたい。差分更新や集計に強い。
- 半構造化: 項目名やタグを利用して整えたい。
- 非構造化: 抽出、分割、メタデータ付与、インデックス化が先に必要。

## 3-2. 構造化データの取り込み方は 2 通り

構造化データを GenAI へ使う方法は、大きく 2 つです。ひとつは行やレコードを文書化して RAG の対象にする方法、もうひとつは表のまま検索・集計させる方法です。

行や列で答えが決まるなら構造化のまま扱う方が自然で、説明文として読ませたいなら文書化してベクトル検索へ乗せる方が扱いやすいことがあります。問題文の要件が、検索なのか集計なのか、説明なのかを先に見るのが重要です。

## 3-3. データカタログと品質管理

構造化データでは、列定義やスキーマを見失わないことが重要です。AWS Glue Data Catalog とクローラーでメタデータを管理し、Glue Data Quality で欠損や異常値の監視を行うと、後続の RAG やエージェント処理の事故を減らせます。

- どのデータがどこにあるかを一覧化する。
- 列定義と型を明示し、変更時に追跡できるようにする。
- 品質ルールを持ち、監視結果を継続的に見る。

## 3-4. 非構造化データは、まず抽出してから検索可能にする

非構造化データは、そのままでは検索しにくいため、まず中身の抽出が必要です。スキャン PDF や画像から文字や表を抜くなら Amazon Textract、音声を文字へ起こすなら Amazon Transcribe、テキスト中の PII 検出には Amazon Comprehend を使えます。

さらに、文書、画像、音声、動画のような混在データを抽出・標準化したい場合は、Amazon Bedrock Data Automation の活用も検討対象になります。

## 3-5. S3 とデータソースごとの差を理解する

Knowledge Bases では、S3 データソースと各種コネクタで、扱える形式やメディアの範囲が異なります。たとえば、S3 上の PDF や Office 文書、CSV、Excel などは取り込み対象にできますが、画像・音声・動画の扱いはデータソース種類によって制限が変わります。

つまり、S3 のバケット設計、コネクタ選定、ファイル形式の統一は、検索品質だけでなく、そもそも取り込めるかどうかに関わる前提条件です。

## 3-6. チャンク分割とメタデータ

長い文書を丸ごと扱うのではなく、検索しやすい単位に分割するのがチャンク分割です。固定サイズ、階層型、意味ベースなどの方式があり、Markdown 見出しや章立てを残せると検索の意味づけが改善しやすくなります。

本文のほかに、部署、年度、文書種別、更新日時、オーナーなどのメタデータを持たせると、絞り込みや再ランキングの質が上がります。Knowledge Bases では、本文列とメタデータ列の扱いに制約があるため、取り込み前の整形が重要です。

## 3-7. 更新に追随する設計

Knowledge Bases の同期は増分処理の考え方で動きます。元データが追加、変更、削除されたら同期を実行して差分を反映します。試験では、最新情報へ追随したいという要件が出たら、まず同期と差分検知を思い出すと整理しやすいです。

- S3 イベントで Lambda を起動し、同期処理や前処理を自動実行する。
- 複数ステップなら Step Functions で抽出、整形、同期、通知をまとめる。
- RDB の差分なら AWS DMS の CDC、DynamoDB なら Streams、定期バッチなら Glue job bookmarks を使い分ける。

## 3-8. 監視と失敗時の見え方を作る

取り込みや同期は失敗する前提で設計する方が実務的です。CloudWatch Logs に取り込みログを集め、Step Functions の実行履歴、Glue のジョブログ、Knowledge Bases の同期ログを追えるようにしておくと、どこで止まったかを切り分けやすくなります。

試験では、更新を自動化するだけでなく、失敗時の再実行性や可観測性まで問われることがあります。

> **この章の試験ポイント**
> 構造化データは文書化するのか、そのまま問い合わせるのかを要件で選ぶこと。
> 非構造化データは抽出、分割、メタデータ付与の順で整理すること。
> 更新要件が出たら、差分検知、Sync、自動化、監視まで一緒に考えること。

# 4. エージェントと運用基盤

この章では、Agents の骨組み、Action group の定義方法、エイリアス運用、Trace と CloudTrail の違い、そして AgentCore の位置づけを整理します。

## 4-1. エージェントが向く場面、向かない場面

エージェントは、曖昧な入力を受けて、必要な知識や道具を選びながら目標へ進む仕組みです。したがって、毎回手順が決まっているワークフローには Flows や Step Functions のような決め打ち設計が向きます。

- 手順が固定なら deterministic workflow を優先する。
- 入力に応じて使う API や KB が変わるなら Agents が向く。
- ツール候補が多すぎる場合は、複数エージェントへの分担が有効。

## 4-2. DRAFT、TSTALIASID、エイリアス、バージョン

Agents は、作業中の DRAFT と、それを指すテスト用の TSTALIASID から始まります。DRAFT を編集して Prepare し、動作に納得したらバージョン化してエイリアスを作り、アプリケーションはそのエイリアスを呼びます。

この考え方を押さえておくと、本番は固定版へ向ける、切り戻しは alias の向き先を戻す、という運用が自然に理解できます。

## 4-3. Action group は何で定義するか

Action group の理解は、今回の改訂で特に直したポイントです。Action group は OpenAPI スキーマで定義する場合もあれば、function details で定義する場合もあります。

さらに、実行の受け先も Lambda に固定ではありません。Lambda へ fulfillment する構成もあれば、return control で必要なパラメータをアプリケーション側へ返し、アプリ側で実行と監査を行う構成もあります。

- 定義方法: OpenAPI schema または function details。
- fulfillment 方法: Lambda または return control。
- 必要なら user confirmation を挟み、危険な操作の前に利用者承認を取れる。

## 4-4. ツール連携の流れ

モデルが勝手に外部 API を直接叩くのではなく、ツールの定義を見て、どのツールが必要かを判断し、必要な引数を組み立て、実体の実行はアプリや Lambda が受け持つ、という流れで理解するのが安全です。

この流れを押さえておくと、権限管理、監査、障害切り分けの責任分界も理解しやすくなります。

## 4-5. 複数エージェントで分担する

multi-agent collaboration では、監督役が複数の協力役へ仕事を振り分け、最後に統合する構成を取れます。複数のドメイン、複数のデータソース、複数の業務 API をひとつの巨大プロンプトで抱え込むより、役割分担した方が運用しやすいことがあります。

- 1 エージェントあたりのプロンプトやツール候補を小さくできる。
- 誤選択の切り分けがしやすい。
- 責務単位で評価、監視、改善を回しやすい。

## 4-6. 運用基盤: 監視、Trace、CloudTrail

CloudWatch は、遅延、エラー、スロットリング、モデル呼び出しログなどの可観測性に使います。Trace は、エージェントがどの知識を引き、どのツールを選び、どの手順で答えを作ったかを追うための仕組みです。CloudTrail は、誰がどの AWS API を呼んだかという監査証跡です。

- Trace: エージェント内部の手順を見る。
- CloudTrail: AWS API の監査証跡を見る。
- Model invocation logging: 入出力内容を保存する機能。既定で無効であり、有効化した場合は保存先の権限と暗号化も含めて設計する。

## 4-7. AgentCore の位置づけ

Amazon Bedrock AgentCore は、エージェントやツールをサーバーレスにホストし、メモリ、Gateway、Identity、Code Interpreter、Browser、Observability などを組み合わせて運用するための実行基盤です。

Gateway は、API、Lambda、既存サービス、MCP サーバーを MCP 互換ツールとして公開しやすくします。Code Interpreter は隔離環境でのコード実行、Browser は管理されたブラウザ操作を提供します。

- Runtime: エージェントやツールの実行環境。
- Memory: セッション内の短期記憶と、複数セッションにまたがる長期記憶。
- Gateway: API や Lambda、MCP ツールの接続レイヤー。
- Identity: OAuth 2.0 など外部接続に必要な認証情報管理。
- Observability: トレース、ログ、監視。

## 4-8. Agents と Flows の使い分け

Flows は手順を設計者が決めるため、テストしやすく、変更影響を読みやすいのが強みです。Agents は、状況に応じたツール選択や追加質問が得意です。

実務では、Flows の一部ノードとして Agent を呼ぶ、あるいは Agent の中で KB や Action group を使う、といった組み合わせも自然です。問題文で求められているのが、予測可能性なのか柔軟性なのかを見極めることが大切です。

> **この章の試験ポイント**
> Action group は OpenAPI だけでなく function details でも定義でき、実行先は Lambda だけでなく return control もあること。
> 本番はエイリアスへ向け、DRAFT と TSTALIASID は主に作業用・テスト用として理解すること。
> Trace と CloudTrail を混同しないこと。

# 5. 運用の効率化

ここでは、トークン、クォータ、キャッシュ、振り分け、可観測性を整理します。AIP-C01 では、コストだけでなく、スループット、スロットリング、遅延、運用の見え方まで含めて考えるのが重要です。

## 5-1. トークンは、費用だけでなくクォータにも効く

Bedrock では、入力トークンと出力トークンがコストに影響するだけでなく、TPM、TPD、RPM といったクォータにも効きます。CountTokens を使えば、実際に推論せずに入力トークン数を見積もれます。

- TPM: 1 分あたりのトークン使用上限。
- TPD: 1 日あたりのトークン使用上限。
- RPM: 1 分あたりのリクエスト上限。
- CountTokens: 無料で入力トークン数を見積もれる。

## 5-2. max_tokens は大きすぎると同時実行数を落とす

リクエスト開始時には、入力トークン数と max_tokens を合わせた量がいったんクォータから差し引かれます。応答終了時に実際の出力量へ調整され、未使用分は戻ります。

つまり、実際の出力が短くても max_tokens を過大にすると、初期差し引きが大きくなり、同時に流せるリクエスト数が減ります。試験では、コスト最適化だけでなく、スループット最適化の観点からも重要です。

## 5-3. 出力トークンの burndown rate

モデルによっては、出力 1 トークンがクォータ上は 1 以上の重みで消費されます。現行ドキュメントでは、Anthropic Claude 3.7 以降のモデルで出力側の burndown rate が 5x とされています。

ここで大切なのは、クォータ消費と請求が同一ではない点です。クォータは 5x で減っても、請求は実トークン数ベースです。

## 5-4. CloudWatch と model invocation logging

CloudWatch では、呼び出し数、遅延、エラー、スロットリング、InputTokenCount、OutputTokenCount、CacheReadInputTokens、CacheWriteInputTokens などを追えます。

詳細ログが必要な場合は model invocation logging を有効化します。ただし、これは既定で無効です。有効化すると入力や出力を CloudWatch Logs や S3 に配信できるため、保存先の暗号化、保持期間、アクセス制御を必ず設計します。

## 5-5. Prompt caching

Prompt caching は、変わらない先頭部分の長いプロンプトをキャッシュし、後続リクエストの遅延と入力コストを下げる仕組みです。今回の改訂では TTL 表現を修正しています。

- 既定の TTL は 5 分。
- 一部の Anthropic Claude モデルでは 1 時間 TTL を使える。
- CacheReadInputTokens は最終的なクォータ計算に含まれない。
- prefix が一致しないとヒットしにくいため、共通部分を先頭へ寄せる設計が必要。

## 5-6. Intelligent prompt routing

Intelligent prompt routing は、同じモデルファミリー内の 2 モデルから、各リクエストに対して品質とコストのバランスが良さそうな方へ振り分ける仕組みです。

- 同一ファミリーからちょうど 2 モデルを選ぶ。
- ルーティング条件とフォールバックモデルを定義する。
- 難しい問いだけ上位モデルへ回したい、という要件に合う。

## 5-7. Inference profiles と cross-Region inference

Inference profiles は、モデルと 1 つ以上のリージョンを束ねるリソースです。使用量メトリクスを追い、タグでコスト配賦し、必要なら複数リージョンへルーティングできます。

cross-Region inference は、これを使って別リージョンのキャパシティも利用する仕組みです。可用性とスループットを高められますが、どのリージョンへ飛ぶか、どのプロファイルを使うかを明示して設計する必要があります。

- Application inference profile はコスト追跡や利用メトリクス管理に使える。
- Cross-Region profile は複数リージョンへルーティングできる。
- 推論価格は、呼び出し元リージョンのモデル価格を基準に計算される。
- Inference profiles は Provisioned Throughput と併用できない。

## 5-8. Provisioned Throughput

Provisioned Throughput は、安定した処理枠を確保したいときの選択肢です。高ボリューム、安定遅延、カスタムモデルや本番系の確実な容量確保といった要件で検討します。

一方で、バースト吸収や一時的な混雑回避が主題なら、cross-Region inference やアプリケーション側の制御の方が自然なこともあります。

> **この章の試験ポイント**
> max_tokens は単なる出力上限ではなく、初期クォータ差し引きにも効くこと。
> Prompt caching の既定 TTL は 5 分であり、一部モデルでは 1 時間 TTL を選べること。
> CloudWatch 指標と model invocation logging を分けて理解すること。

# 6. プロンプト管理と Flows

この章では、再利用できるプロンプト資産としての Prompt management と、複数ステップをつなぐ Flows を整理します。

## 6-1. Prompt management の考え方

Prompt management は、指示文、使用モデル、推論設定、変数、テスト、版管理をまとめて扱う仕組みです。毎回コードへ文字列直書きするのではなく、プロンプトを資産として管理するために使います。

- 変数を埋め込んで再利用できる。
- バリアントを比較しやすい。
- DRAFT と version を分けて、本番投入前に固定版を作れる。
- Flow の prompt node や Converse から再利用できる。

## 6-2. 変数、バリアント、バージョン

変数は {{variable}} の形式で埋め込み、呼び出し時に promptVariables で値を渡します。バリアントは比較用の別パターン、バージョンは固定して本番利用するためのスナップショットです。

設計上は、バリアントで比較して良い案を決め、その時点を version 化してアプリケーションから参照する、という流れを基本にすると安定します。

## 6-3. Converse から prompt version ARN を呼ぶときの制約

Prompt management のプロンプトを Converse で使う場合、modelId には prompt version の ARN を指定します。このとき、呼び出し側で自由に追加できないフィールドがあります。

- additionalModelRequestFields は付けられない。
- inferenceConfig は付けられない。
- system は付けられない。
- toolConfig は付けられない。
- messages を付けた場合は、プロンプト内メッセージの後ろへ追加される。

## 6-4. Prompt optimization

Prompt optimization は、既存プロンプトを解析して、目的に合いやすい書き換え案を出す機能です。行き詰まったときの自動改善の入口として覚えておくと便利です。

ただし、最適化結果をそのまま本番へ入れるのではなく、既存の評価データや人手レビューで比較して採用可否を決める、という運用が前提です。

## 6-5. Flows の基本

Flows は、ノードと接続で構成されるワークフローです。入力ノードから始まり、条件ノード、Knowledge Bases ノード、Prompt ノード、Lambda ノード、S3 ノードなどを通って出力へ至ります。

手順が決まる処理を視覚的かつ版管理しやすい形で組めるのが利点で、Agents より予測可能性とテスト性に寄っています。

## 6-6. Flows の式とデータの渡し方

Flow 内では JSONPath の一部を使って、上流から渡ってきたデータのどの部分を下流ノードへ渡すかを指定します。基本の起点は \$.data です。

入力オブジェクトの形を先に設計しておくと、どのノードへ何を渡すかが明確になり、後から Lambda や Knowledge Bases ノードを差し替えやすくなります。

## 6-7. DRAFT、version、alias

Flows も prompt や agent と同様に、作業中の DRAFT、固定版の version、呼び出し先の alias を分けて運用します。作成直後には DRAFT と TSTALIASID があり、そこから version を切って alias を本番用に向けます。

本番アプリケーションは alias を呼ぶため、問題が出たら alias を以前の version へ戻せます。これは Prompt management や Agents と同じ運用パターンです。

## 6-8. InvokeFlow とトレース

InvokeFlow は flow alias を呼び出し、各ノードの出力をストリームとして返します。enableTrace を true にすると、どのノードへ何が入り、何が出たかを追跡できます。

また、agent node を含む flow では、マルチターン会話を使って不足情報をユーザーへ聞き返し、回答後に再開する構成も取れます。

> **この章の試験ポイント**
> Prompt management の prompt を Converse で呼ぶとき、呼び出し側で付けられない設定があること。
> Prompt の変数、バリアント、バージョンの役割を分けて理解すること。
> Flows は DRAFT → version → alias で本番化し、手順が決まる処理に向くこと。

# 7. ガバナンス・品質評価・安全対策

この章では、Trace と監査、Organizations による制御、評価ジョブ、Guardrails の運用、そして継続改善の考え方をまとめます。AIP-C01 では、この章の論点が複数のドメインにまたがって出題されやすいです。

## 7-1. ガバナンスは、後から説明できる状態を作ること

ガバナンスの目的は、誰が、どの設定で、どのモデルやガードレールを使い、どのような結果が出たのかを後から説明できるようにすることです。

- エージェント内部の手順は Trace で追う。
- AWS API の証跡は CloudTrail で追う。
- モデル入出力の記録が必要なら model invocation logging を使う。
- 設定変更、バージョン、エイリアス、ガードレール適用状態を継続的に管理する。

## 7-2. 組織単位の制御

AWS Organizations では、SCP によって使用可能な API や操作を上限として制御できます。加えて、Amazon Bedrock policies により、Guardrails の適用を組織単位で強制する仕組みもあります。

ただし、Guardrails enforcements は現時点で preview です。試験では、機能の存在だけでなく、プレビューであること、強制対象のフィルタ種別、必要なリソースベースポリシーまで読み取れるとより安全です。

- SCP は最大権限制御。IAM で許可しても SCP で拒否されれば使えない。
- Guardrails enforcement はアカウント横断の統一に向く。
- 強制する guardrail は version を使い、DRAFT を指定しない。

## 7-3. データ保護とネットワーク分離

Bedrock のデータ保護は共有責任モデルで考えます。サービス既定ではプロンプトや補完結果を保存しませんが、利用者がログ保存を有効にするかどうか、どこへ保存するか、誰が見られるかは利用者側の責任です。

また、インターネットへ出したくない要件には、VPC、PrivateLink、KMS、最小権限 IAM、CloudTrail、CloudWatch を組み合わせます。

## 7-4. 品質評価は ground truth から始める

モデル評価は、感覚ではなく、基準と比較対象を作って進めます。質問と参照回答、必要なら参照コンテキストを含む ground truth データセットを用意し、人手評価、組み込み評価指標、model-as-a-judge を組み合わせて見ます。

- 自動評価: モデル評価ジョブで task と metric を選ぶ。
- 人手評価: 最大 2 系統の推論結果を比較し、UX 的な差も見られる。
- RAG 評価: retrieve only と retrieve and generate を分けて考える。

## 7-5. RAG 評価の見方

RAG では、検索と最終回答を分けて評価するのが重要です。retrieve only では context relevance や context coverage を見ます。retrieve and generate では correctness、completeness、helpfulness、faithfulness、citation precision / coverage などを見ます。

検索品質が悪いのに生成側だけ直そうとしても改善は頭打ちになります。逆に、検索が良くても生成プロンプトやガードレールが悪いと、回答は崩れます。

## 7-6. Guardrails の主要機能

Guardrails は、コンテンツフィルタ、denied topics、word filters、sensitive information filters、contextual grounding checks、automated reasoning checks、prompt attack detection などを組み合わせる安全層です。

- ブロック: 危険な入出力を止める。
- マスク: PII などを伏せる。
- 検出だけ: 本番導入前に影響を見たいときに向く。

## 7-7. contextual grounding と automated reasoning の注意

contextual grounding checks は、参照ソースとユーザー質問を前提に、回答が根拠に基づくかと質問に関連するかを見ます。要約、言い換え、質問応答向けで、Conversational QA / chatbot 用途はサポート対象外です。

automated reasoning checks は、定義したルールに照らして回答を論理的に検証します。英語のみ、ストリーミング非対応といった制約があり、prompt injection 防御の単独手段としては考えません。

- ルール検証は強力だが、入力検証、Guardrails、権限分離、監査と組み合わせて使う。
- Guardrails enforcement では、自動推論ポリシーをそのまま強制対象にできない点にも注意する。

## 7-8. 継続改善

評価は一度きりではなく、モデル差し替え、プロンプト変更、ガードレール更新、チャンク戦略変更のたびに回します。変更前後で同じデータセットを流し、改善なのか退行なのかを明確にする姿勢が重要です。

Well-Architected の Generative AI Lens は、この継続改善を運用、セキュリティ、信頼性、性能、コスト、持続可能性の観点で見直すためのフレームワークとして有用です。ただし、日付表現は初版日と改訂日を混同しないようにします。

> **この章の試験ポイント**
> 組織全体の統制には SCP と Bedrock policies を使い分けること。
> 評価は検索段階と生成段階を分けて見ること。
> Guardrails は多層防御の一部であり、単独で万能と考えないこと。

# 付録 A. 今回の改訂で直した重要点

元の文章の流れは活かしつつ、誤解や断定が生じやすい箇所を中心に修正しました。試験対策として特に重要なものを下表にまとめます。

| **論点**                  | **旧版で問題になりやすかった点**        | **改訂版での整理**                                                              |
|---------------------------|-----------------------------------------|---------------------------------------------------------------------------------|
| Action group              | OpenAPI + Lambda に固定したように読める | OpenAPI schema または function details。Lambda または return control を選べる   |
| Prompt caching TTL        | TTL を 5 分で固定していた               | 既定は 5 分。一部 Claude で 1 時間 TTL を選べる                                 |
| Bedrock の非保存性        | 保存しない説明と、ログ機能の関係が曖昧  | 既定では保存しないが、model invocation logging を有効にすると保存先へ配信される |
| Guardrails enforcements   | 一般提供済みのように読める              | 現時点では preview と明記                                                       |
| Generative AI Lens の日付 | 2025-11-19 を初公開のように書いていた   | Publication date と initial publication を分けて表記                            |

## 学習時の見方のコツ

- まずは、Prompt / RAG / Fine-tuning / Agent / Flow を、何を変える手段なのかで区別する。
- 次に、Trace / CloudTrail / CloudWatch / model invocation logging を、何を見る仕組みかで区別する。
- 最後に、OpenSearch / S3 Vectors / Knowledge Bases を、保存、検索、運用、コストの軸で区別する。

# 付録 B. 主要な一次資料

本改訂では、主に次の一次資料を参照して事実関係を確認しました。URL を暗記する必要はありませんが、実務で迷ったときにどのカテゴリの資料を見るべきかを押さえておくと役に立ちます。

- Amazon Bedrock User Guide: Overview / Data protection / Model access / Prompt caching / Inference profiles / Count tokens / Quotas
- Amazon Bedrock API Reference: Converse / CountTokens / InvokeFlow / InvokeAgent / OptimizePrompt
- Amazon Bedrock User Guide: Prompt management / Flows / Agents / Guardrails / Knowledge Bases / Contextual grounding / Automated reasoning
- Amazon S3 User Guide: S3 Vectors / Metadata filtering / Limitations and restrictions
- Amazon OpenSearch Service Developer Guide and OpenSearch vector search documentation
- AWS Organizations User Guide: Amazon Bedrock policies
- AWS Well-Architected Framework: Generative AI Lens
- AWS Certification Exam Guide: AWS Certified Generative AI Developer - Professional (AIP-C01)

> **最後に**
> この文書は、機能一覧を丸暗記するためではなく、要件から適切な選択肢を絞るための整理文書です。
> 試験本番では、問題文の要件を 目的、データ、更新頻度、安全性、監査、運用 の観点で分解すると、選択肢の良し悪しが見えやすくなります。
