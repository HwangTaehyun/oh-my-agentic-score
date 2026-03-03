import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Oh My Agentic Score',
  description: 'Measure agentic coding performance',

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
  ],

  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Reference', link: '/reference/configuration' },
      {
        text: 'GitHub',
        link: 'https://github.com/HwangTaehyun/oh-my-agentic-score',
      },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Introduction',
          items: [
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'CLI Commands', link: '/guide/cli-commands' },
          ],
        },
        {
          text: 'Features',
          items: [
            { text: 'Scoring System', link: '/guide/scoring' },
            { text: 'Thread Types', link: '/guide/thread-types' },
            { text: 'Fair Comparison', link: '/guide/fair-comparison' },
            { text: 'Dashboard', link: '/guide/dashboard' },
            { text: 'TUI Mode', link: '/guide/tui-mode' },
            { text: 'Cloud Upload', link: '/guide/cloud-upload' },
          ],
        },
      ],
      '/reference/': [
        {
          text: 'Reference',
          items: [
            { text: 'Configuration', link: '/reference/configuration' },
            { text: 'Cloud API', link: '/reference/api' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/HwangTaehyun/oh-my-agentic-score' },
    ],

    search: {
      provider: 'local',
    },

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright 2025 Taehyun Hwang',
    },
  },
})
