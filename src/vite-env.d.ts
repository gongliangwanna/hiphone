/// <reference types="vite/client" />
/// <reference types="@testing-library/jest-dom/vitest" />

declare module '*.css' {
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
