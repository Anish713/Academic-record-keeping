import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or explicitly defined here.

 Create as many sidebars as you want.
 */
const sidebars: SidebarsConfig = {
  docsSidebar: [
    {
      type: 'category',
      label: 'Getting Started',
      items: [
        'getting-started/overview'
      ],
    },
    {
      type: 'category',
      label: 'Architecture',
      items: [
        'architecture/smart-contracts',
        'architecture/frontend',
      ],
    },
    {
      type: 'category',
      label: 'Workflows',
      items: [
        'workflows/user-workflows',
      ],
    },
    {
      type: 'category',
      label: 'Diagrams',
      items: [
        'diagrams/index',
      ],
    },
  ],
};

export default sidebars;
