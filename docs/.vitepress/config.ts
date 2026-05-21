import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Burst Docs',
  description: 'API guides, architecture, registry structures, and maintainer toolchains for Burst.',
  head: [['link', { rel: 'icon', href: '/logo.svg' }]],
  themeConfig: {
    logo: '/logo.svg',
    nav: [
      { text: 'Home', link: '/' },
      { text: 'API Guide', link: '/api-guide' },
      { text: 'Registry Toolchain', link: '/registry-toolchain' },
      { text: 'Project Guide', link: '/project-guide' },
      { text: 'Project Status', link: '/project-status' },
      { text: 'Roadmap', link: '/roadmap' },
    ],
    sidebar: [
      {
        text: 'Introduction',
        items: [
          { text: 'What is Burst?', link: '/' },
          { text: 'Project Status', link: '/project-status' },
          { text: 'Roadmap', link: '/roadmap' },
        ],
      },
      {
        text: 'Development & Registry',
        items: [
          { text: 'Extension API Guide', link: '/api-guide' },
          { text: 'Registry & Toolchain Guide', link: '/registry-toolchain' },
          { text: 'Project Developer Guide', link: '/project-guide' },
        ],
      },
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/yukai/Projects/Personal/burst' },
    ],
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2026 Burst Authors',
    },
  },
});
