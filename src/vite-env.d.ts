/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
/// <reference types="@testing-library/jest-dom/vitest" />

declare module '*.css' {
  const content: string;
  export default content;
}

// @tailwindcss/browser ships side-effect-only (auto-scans document on
// import, injects <style> into <head>). It has no TS declarations; we
// never touch the namespace — only `import()` for the side effect.
declare module '@tailwindcss/browser';

declare module '*?raw' {
  const content: string;
  export default content;
}

declare module 'lunar-javascript' {
  export class Solar {
    static fromDate(date: Date): Solar;
    getLunar(): Lunar;
  }
  export class Lunar {
    getYearInGanZhi(): string;
    getMonthInChinese(): string;
    getDayInChinese(): string;
  }
}
