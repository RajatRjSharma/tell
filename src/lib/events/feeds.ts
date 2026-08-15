export type PolicyFeed = {
  id: string;
  source: string;
  countryCode: string;
  type: string;
  url: string;
};

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
];
