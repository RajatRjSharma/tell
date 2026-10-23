import { describe, expect, it } from "vitest";
import {
  parseImfSdmxSeries,
  sdmxPeriodToObservedFor,
  type ImfSdmxResponse,
} from "@/lib/imf-sdmx";

const PAYLOAD: ImfSdmxResponse = {
  data: {
    dataSets: [
      {
        series: {
          "0:0:0:0:0": {
            observations: {
              "0": ["3.1", null, 0],
              "1": ["3.4", null, 0],
            },
          },
          "1:0:0:0:0": {
            observations: { "1": ["4.44", null, 0], "2": [null, null, 0] },
          },
          "2:0:0:0:0": { observations: { "0": ["9.9"] } },
        },
      },
    ],
    structures: [
      {
        dimensions: {
          series: [
            {
              id: "COUNTRY",
              values: [{ id: "USA" }, { id: "IND" }, { id: "BRA" }],
            },
            { id: "INDEX_TYPE", values: [{ id: "CPI" }] },
            { id: "COICOP_1999", values: [{ id: "_T" }] },
            { id: "TYPE_OF_TRANSFORMATION", values: [{ id: "YOY_PCH_PA_PT" }] },
            { id: "FREQUENCY", values: [{ id: "M" }] },
          ],
          observation: [
            {
              id: "TIME_PERIOD",
              values: [
                { value: "2026-M08" },
                { value: "2026-M09" },
                { value: "2026-M10" },
              ],
            },
          ],
        },
      },
    ],
  },
};

describe("sdmxPeriodToObservedFor", () => {
  it("normalises monthly, quarterly and annual periods", () => {
    expect(sdmxPeriodToObservedFor("2026-M09")).toBe("2026-09-01");
    expect(sdmxPeriodToObservedFor("2026-09")).toBe("2026-09-01");
    expect(sdmxPeriodToObservedFor("2026-Q3")).toBe("2026-07-01");
    expect(sdmxPeriodToObservedFor("2026")).toBe("2026-01-01");
    expect(sdmxPeriodToObservedFor("bad")).toBeNull();
  });
});

describe("parseImfSdmxSeries", () => {
  it("maps ISO-3 series to ISO-2 readings and skips missing values", () => {
    const parsed = parseImfSdmxSeries(PAYLOAD, ["US", "IN"]);
    expect(parsed.US).toEqual([
      { observedFor: "2026-08-01", value: 3.1 },
      { observedFor: "2026-09-01", value: 3.4 },
    ]);
    expect(parsed.IN).toEqual([{ observedFor: "2026-09-01", value: 4.44 }]);
    expect(parsed).not.toHaveProperty("BR");
  });

  it("returns nothing when the payload has no COUNTRY dimension", () => {
    expect(parseImfSdmxSeries({ data: {} }, ["US"])).toEqual({});
  });
});
