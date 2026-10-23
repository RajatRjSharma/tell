import { describe, expect, it } from "vitest";
import { parseTreasuryYieldXml, treasuryToReadings } from "@/lib/treasury";

const XML = `<feed>
<entry><content type="application/xml"><m:properties>
<d:NEW_DATE m:type="Edm.DateTime">2026-10-22T00:00:00</d:NEW_DATE>
<d:BC_2YEAR m:type="Edm.Double">3.51</d:BC_2YEAR>
<d:BC_10YEAR m:type="Edm.Double">4.12</d:BC_10YEAR>
</m:properties></content></entry>
<entry><content type="application/xml"><m:properties>
<d:NEW_DATE m:type="Edm.DateTime">2026-10-21T00:00:00</d:NEW_DATE>
<d:BC_2YEAR m:type="Edm.Double">3.49</d:BC_2YEAR>
<d:BC_10YEAR m:type="Edm.Double" m:null="true"></d:BC_10YEAR>
</m:properties></content></entry>
</feed>`;

describe("parseTreasuryYieldXml", () => {
  it("reads dates and 2y/10y yields, sorted", () => {
    expect(parseTreasuryYieldXml(XML)).toEqual([
      { date: "2026-10-21", twoYear: 3.49, tenYear: null },
      { date: "2026-10-22", twoYear: 3.51, tenYear: 4.12 },
    ]);
  });
});

describe("treasuryToReadings", () => {
  it("builds DGS2, DGS10 and the 10Y-2Y spread only when both exist", () => {
    const readings = treasuryToReadings(parseTreasuryYieldXml(XML));
    expect(readings.DGS2).toHaveLength(2);
    expect(readings.DGS10).toEqual([
      { observedFor: "2026-10-22", value: 4.12 },
    ]);
    expect(readings.T10Y2Y).toEqual([
      { observedFor: "2026-10-22", value: 0.61 },
    ]);
  });
});
