export type PolicyFeed = {
  id: string;
  source: string;
  countryCode: string;
  type: string;
  url: string;
};

export type PolicySource = {
  id: string;
  name: string;
  currency: string;
};

/** Central banks Tell tracks; `id` matches `events.source`. */
export const POLICY_SOURCES: PolicySource[] = [
  { id: "Fed", name: "US Federal Reserve", currency: "the US dollar" },
  { id: "ECB", name: "European Central Bank", currency: "the euro" },
  { id: "BoE", name: "Bank of England", currency: "sterling" },
  { id: "BoJ", name: "Bank of Japan", currency: "the yen" },
  { id: "RBI", name: "Reserve Bank of India", currency: "the rupee" },
];

/** Free central-bank RSS feeds used for policy/event context. */
export const POLICY_FEEDS: PolicyFeed[] = [
  {
    id: "fed-monetary",
    source: "Fed",
    countryCode: "US",
    type: "policy",
    url: "https://www.federalreserve.gov/feeds/press_monetary.xml",
  },
  {
    id: "ecb-press",
    source: "ECB",
    countryCode: "DE",
    type: "policy",
    url: "https://www.ecb.europa.eu/rss/press.html",
  },
  {
    id: "boe-news",
    source: "BoE",
    countryCode: "GB",
    type: "policy",
    url: "https://www.bankofengland.co.uk/rss/news",
  },
  {
    id: "boj-whatsnew",
    source: "BoJ",
    countryCode: "JP",
    type: "policy",
    url: "https://www.boj.or.jp/en/rss/whatsnew.xml",
  },
  {
    id: "rbi-press",
    source: "RBI",
    countryCode: "IN",
    type: "policy",
    url: "https://rbi.org.in/pressreleases_rss.xml",
  },
];
