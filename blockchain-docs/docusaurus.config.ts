import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: "CertiChain",
  tagline: "Secure, verifiable academic records on the blockchain",
  favicon: "img/favicon.ico",

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  // Set the production url of your site here
  url: "https://academic-record-keeping.vercel.app",
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: "/",

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: "blockchain-record-keeping",
  projectName: "CertiChain",

  onBrokenLinks: "throw",
  onBrokenMarkdownLinks: "warn",

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  presets: [
    [
      "classic",
      {
        docs: {
          sidebarPath: "./sidebars.ts",
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl: "/",
          routeBasePath: "/", // Serve docs at the root path
        },
        blog: false, // Disable blog feature
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    // Replace with your project's social card
    image: "img/docusaurus-social-card.jpg",
    navbar: {
      title: "CertiChain",
      logo: {
        alt: "Blockchain Record Keeping Logo",
        src: "img/favicon.ico",
      },
      items: [
        {
          type: "docSidebar",
          sidebarId: "docsSidebar",
          position: "left",
          label: "Documentation",
        },
        {
          href: "https://github.com/Anish713/Academic-record-keeping",
          label: "GitHub",
          position: "right",
        },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Docs",
          items: [
            {
              label: "Overview",
              to: "/",
            },
            {
              label: "Architecture",
              to: "/architecture/smart-contracts",
            },
            {
              label: "Workflows",
              to: "/workflows/user-workflows",
            },
          ],
        },
        {
          title: "Community",
          items: [
            {
              label: "GitHub",
              href: "https://github.com/blockchain-record-keeping/blockchain-docs",
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} CertiChain | Blockchain Record Keeping. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ["solidity"],
    },
  } satisfies Preset.ThemeConfig,

  // Disable the pages feature since we're using docs at root path
  plugins: [
    function noPages() {
      return {
        name: "no-pages",
        configureWebpack() {
          return {
            resolve: {
              alias: {
                "@site/src/pages": "@site/src/non-existent",
              },
            },
          };
        },
      };
    },
  ],
};

export default config;
