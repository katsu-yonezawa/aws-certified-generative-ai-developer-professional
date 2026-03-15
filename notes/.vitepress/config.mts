import { defineConfig } from "vitepress";

const repoName = "aws-certified-generative-ai-developer-professional";
const base = process.env.GITHUB_ACTIONS ? `/${repoName}/` : "/";
const noteItems = [
  { text: "トップ", link: "/" },
  { text: "試験概要", link: "/00_%E8%A9%A6%E9%A8%93%E6%A6%82%E8%A6%81" },
  { text: "生成AIの基礎整理", link: "/08_%E7%94%9F%E6%88%90AI%E3%81%AE%E5%9F%BA%E7%A4%8E%E6%95%B4%E7%90%86" },
  { text: "SageMaker", link: "/01_SageMaker" },
  { text: "Bedrock", link: "/02_Bedrock" },
  { text: "実装と統合", link: "/03_%E5%AE%9F%E8%A3%85%E3%81%A8%E7%B5%B1%E5%90%88" },
  { text: "安全性とガバナンス", link: "/04_%E5%AE%89%E5%85%A8%E6%80%A7%E3%81%A8%E3%82%AC%E3%83%90%E3%83%8A%E3%83%B3%E3%82%B9" },
  { text: "運用最適化と監視", link: "/05_%E9%81%8B%E7%94%A8%E6%9C%80%E9%81%A9%E5%8C%96%E3%81%A8%E7%9B%A3%E8%A6%96" },
  { text: "評価とトラブルシューティング", link: "/06_%E8%A9%95%E4%BE%A1%E3%81%A8%E3%83%88%E3%83%A9%E3%83%96%E3%83%AB%E3%82%B7%E3%83%A5%E3%83%BC%E3%83%86%E3%82%A3%E3%83%B3%E3%82%B0" },
  { text: "頻出比較と解答パターン", link: "/07_%E9%A0%BB%E5%87%BA%E6%AF%94%E8%BC%83%E3%81%A8%E8%A7%A3%E7%AD%94%E3%83%91%E3%82%BF%E3%83%BC%E3%83%B3" },
  { text: "実戦問題集", link: "/09_%E5%AE%9F%E6%88%A6%E5%95%8F%E9%A1%8C%E9%9B%86" },
  { text: "付録: 実務パターン集", link: "/10_%E4%BB%98%E9%8C%B2_%E5%AE%9F%E5%8B%99%E3%83%91%E3%82%BF%E3%83%BC%E3%83%B3%E9%9B%86" }
] as const;

export default defineConfig({
  lang: "ja-JP",
  title: "AWS GenAI Dev Pro Notes",
  description: "AWS Certified Generative AI Developer - Professional 試験対策ノート",
  base,
  cleanUrls: true,
  lastUpdated: true,
  themeConfig: {
    nav: [
      { text: "ホーム", link: "/" },
      { text: "試験概要", link: "/00_%E8%A9%A6%E9%A8%93%E6%A6%82%E8%A6%81" },
      { text: "基礎整理", link: "/08_%E7%94%9F%E6%88%90AI%E3%81%AE%E5%9F%BA%E7%A4%8E%E6%95%B4%E7%90%86" },
      { text: "Bedrock", link: "/02_Bedrock" },
      { text: "SageMaker", link: "/01_SageMaker" },
      { text: "実装と統合", link: "/03_%E5%AE%9F%E8%A3%85%E3%81%A8%E7%B5%B1%E5%90%88" },
      { text: "問題集", link: "/09_%E5%AE%9F%E6%88%A6%E5%95%8F%E9%A1%8C%E9%9B%86" }
    ],
    sidebar: [
      {
        text: "ノート",
        items: noteItems
      }
    ],
    outline: {
      level: [2, 3],
      label: "このページ"
    },
    sidebarMenuLabel: "ノート一覧",
    returnToTopLabel: "先頭へ戻る",
    darkModeSwitchLabel: "テーマ切り替え",
    lightModeSwitchTitle: "ライトモード",
    darkModeSwitchTitle: "ダークモード",
    docFooter: {
      prev: "前へ",
      next: "次へ"
    },
    search: {
      provider: "local",
      options: {
        translations: {
          button: {
            buttonText: "検索",
            buttonAriaLabel: "検索"
          },
          modal: {
            noResultsText: "該当するページはありません",
            resetButtonTitle: "検索条件をクリア",
            footer: {
              selectText: "選択",
              navigateText: "移動",
              closeText: "閉じる"
            }
          }
        }
      }
    },
    socialLinks: [
      {
        icon: "github",
        link: "https://github.com/katsu-yonezawa/aws-certified-generative-ai-developer-professional"
      }
    ],
    footer: {
      message: "公式情報ベースで継続更新",
      copyright: "Copyright 2026"
    }
  }
});
