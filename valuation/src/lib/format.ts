// Currency / percent formatters. All times displayed in MT (America/Denver).

const USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const USD_PRECISE = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

const PERCENT = new Intl.NumberFormat('en-US', {
  style: 'percent',
  maximumFractionDigits: 1,
});

const PERCENT_PRECISE = new Intl.NumberFormat('en-US', {
  style: 'percent',
  maximumFractionDigits: 2,
});

const MULTIPLE = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

const MT_DATE = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Denver',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

export const fmt = {
  usd: (n: number) => USD.format(n),
  usdPrecise: (n: number) => USD_PRECISE.format(n),
  pct: (n: number) => PERCENT.format(n),
  pctPrecise: (n: number) => PERCENT_PRECISE.format(n),
  multiple: (n: number) => `${MULTIPLE.format(n)}x`,
  mtDate: (d: Date = new Date()) => MT_DATE.format(d),
};
