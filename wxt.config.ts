import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    build: {
      rollupOptions: {
        output: {
          // Force ASCII-safe escaping so characters like \uffff are written as \uffff rather than raw bytes
          // which triggers Chrome's UTF-8 validator on Windows
          generatedCode: {
            symbols: true,
          },
        },
      },
    },
  }),
  manifest: {
    name: 'Coursera Autonomous Study Assistant',
    version: '3.5.0',
    description: 'Autonomous, human-paced course completion and tracking engine for Coursera.',
    permissions: ['storage', 'activeTab', 'tabs'],
    host_permissions: [
      '*://*.coursera.org/*',
      '<all_urls>'
    ],
    action: {
      default_title: 'Study Assistant Dashboard'
    }
  }
});
