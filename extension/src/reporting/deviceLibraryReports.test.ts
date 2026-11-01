import { describe, expect, it } from "vitest";
import { normalizePinName, fetchDeviceDetails, compareDevices, verifyPinPadMapping } from "./deviceLibraryReports.js";

describe("deviceLibraryReports", () => {
  describe("normalizePinName", () => {
    it("normalizes power, ground, reset and NC aliases", () => {
      expect(normalizePinName("VSS")).toBe("GND");
      expect(normalizePinName("0V")).toBe("GND");
      expect(normalizePinName("VDD")).toBe("VCC");
      expect(normalizePinName("3V3")).toBe("VCC");
      expect(normalizePinName("NRST")).toBe("RESET");
      expect(normalizePinName("RST")).toBe("RESET");
      expect(normalizePinName("DNC")).toBe("NC");
      expect(normalizePinName("PA0")).toBe("PA0");
    });
  });

  describe("fetchDeviceDetails", () => {
    const mockSchCompU1 = {
      getState_PrimitiveId: () => "sch-u1",
      getState_Designator: () => "U1",
      getState_Title: () => "CH340G",
      getState_Footprint: () => "SOIC-16",
      getState_LcscCode: () => "C14257",
      getState_Pins: () => [
        { getState_PinNumber: () => "1", getState_PinName: () => "GND", getState_PinType: () => "power" },
        { getState_PinNumber: () => "2", getState_PinName: () => "TXD", getState_PinType: () => "output" },
        { getState_PinNumber: () => "3", getState_PinName: () => "RXD", getState_PinType: () => "input" },
        { getState_PinNumber: () => "16", getState_PinName: () => "VCC", getState_PinType: () => "power" }
      ]
    };

    const mockPcbCompU1 = {
      getState_PrimitiveId: () => "pcb-u1",
      getState_Designator: () => "U1",
      getState_Footprint: () => "SOIC-16",
      getState_Pads: () => [
        {
          getState_PadNumber: () => "1",
          getState_Shape: () => "RECTANGLE",
          getState_Width: () => 1.5,
          getState_Height: () => 0.6
        },
        {
          getState_PadNumber: () => "2",
          getState_Shape: () => "RECTANGLE",
          getState_Width: () => 1.5,
          getState_Height: () => 0.6
        },
        {
          getState_PadNumber: () => "3",
          getState_Shape: () => "RECTANGLE",
          getState_Width: () => 1.5,
          getState_Height: () => 0.6
        },
        {
          getState_PadNumber: () => "16",
          getState_Shape: () => "RECTANGLE",
          getState_Width: () => 1.5,
          getState_Height: () => 0.6
        }
      ]
    };

    it("resolves device and cross-references schematic pins with PCB pads by designator", async () => {
      const api = () => ({
        sch_PrimitiveComponent: {
          getAll: async () => [mockSchCompU1]
        },
        pcb_PrimitiveComponent: {
          getAll: async () => [mockPcbCompU1]
        }
      });

      const res = await fetchDeviceDetails(api, { designator: "U1", includePinPadMap: true });
      expect(res.device.name).toBe("CH340G");
      expect(res.device.package).toBe("SOIC-16");
      expect(res.device.lcscCode).toBe("C14257");
      expect(res.symbol?.pinsCount).toBe(4);
      expect(res.footprint?.padsCount).toBe(4);
      expect(res.pinPadMapping).toHaveLength(4);
      expect(res.mappingIntegrity.complete).toBe(true);
      expect(res.mappingIntegrity.unmappedPins).toHaveLength(0);
      expect(res.mappingIntegrity.unmappedPads).toHaveLength(0);
    });

    it("identifies unmapped pins and unmapped pads when mismatch occurs", async () => {
      const mockMismatchedSch = {
        getState_Designator: () => "D1",
        getState_Title: () => "LED_DUAL",
        getState_Footprint: () => "SOD-123",
        getState_Pins: () => [
          { getState_PinNumber: () => "1", getState_PinName: () => "A" },
          { getState_PinNumber: () => "2", getState_PinName: () => "K" },
          { getState_PinNumber: () => "3", getState_PinName: () => "NC" } // Pin 3 does not exist in 2-pad footprint!
        ]
      };

      const mockMismatchedPcb = {
        getState_Designator: () => "D1",
        getState_Pads: () => [{ getState_PadNumber: () => "1" }, { getState_PadNumber: () => "2" }]
      };

      const api = () => ({
        sch_PrimitiveComponent: {
          getAll: async () => [mockMismatchedSch]
        },
        pcb_PrimitiveComponent: {
          getAll: async () => [mockMismatchedPcb]
        }
      });

      const res = await fetchDeviceDetails(api, { designator: "D1" });
      expect(res.mappingIntegrity.complete).toBe(false);
      expect(res.mappingIntegrity.unmappedPins).toEqual(["3"]);
      expect(res.mappingIntegrity.issues[0]).toContain("1 symbol pins have no corresponding footprint pad");
    });

    it("throws if query parameters are missing", async () => {
      const api = () => ({});
      await expect(fetchDeviceDetails(api, {})).rejects.toThrow(
        "One of 'designator', 'deviceUuid', or 'lcscCode' is required."
      );
    });
  });

  describe("compareDevices", () => {
    it("reports identical drop-in replacement when packages, pins and pinout match perfectly", async () => {
      const api = () => ({
        lib_Device: {
          get: async (uuid: string) => {
            if (uuid === "DEV_A") {
              return {
                uuid: "DEV_A",
                name: "NE555P",
                manufacturer: "TI",
                package: "DIP-8",
                isJlcBasic: true,
                inStock: true,
                pins: [
                  { number: "1", name: "GND", electricalType: "power" },
                  { number: "2", name: "TRIG", electricalType: "input" },
                  { number: "3", name: "OUT", electricalType: "output" },
                  { number: "4", name: "RESET", electricalType: "input" },
                  { number: "8", name: "VCC", electricalType: "power" }
                ],
                pads: [{ number: "1" }, { number: "2" }, { number: "3" }, { number: "4" }, { number: "8" }]
              };
            }
            if (uuid === "DEV_B") {
              return {
                uuid: "DEV_B",
                name: "LM555CN",
                manufacturer: "ON Semi",
                package: "DIP-8",
                isJlcBasic: false,
                inStock: true,
                pins: [
                  { number: "1", name: "GND", electricalType: "power" },
                  { number: "2", name: "TRIG", electricalType: "input" },
                  { number: "3", name: "OUT", electricalType: "output" },
                  { number: "4", name: "RESET", electricalType: "input" },
                  { number: "8", name: "VCC", electricalType: "power" }
                ],
                pads: [{ number: "1" }, { number: "2" }, { number: "3" }, { number: "4" }, { number: "8" }]
              };
            }
            return null;
          }
        }
      });

      const res = await compareDevices(api, { deviceA: "DEV_A", deviceB: "DEV_B" });
      expect(res.summary.dropInReplacement).toBe(true);
      expect(res.summary.pinoutMatch).toBe("identical");
      expect(res.summary.footprintMatch).toBe("identical");
      expect(res.summary.compatibilityScorePercent).toBe(100);
      expect(res.comparison.availability.recommendedSupply).toBe("deviceA"); // DEV_A is JLC Basic part
      expect(res.recommendation).toContain("exact drop-in replacement");
    });

    it("flags pinout incompatibilities when pin names or functions conflict", async () => {
      const api = () => ({
        lib_Device: {
          get: async (uuid: string) => {
            if (uuid === "OPAMP_A") {
              return {
                name: "OPA2134",
                package: "SOIC-8",
                pins: [
                  { number: "1", name: "OUTA" },
                  { number: "2", name: "INA-" },
                  { number: "3", name: "INA+" },
                  { number: "4", name: "V-" }
                ],
                pads: [{ number: "1" }, { number: "2" }, { number: "3" }, { number: "4" }]
              };
            }
            if (uuid === "DIFF_B") {
              return {
                name: "CUSTOM_IC",
                package: "SOIC-8",
                pins: [
                  { number: "1", name: "VCC" }, // Conflict! OUTA vs VCC
                  { number: "2", name: "GND" },
                  { number: "3", name: "CLK" },
                  { number: "4", name: "DATA" }
                ],
                pads: [{ number: "1" }, { number: "2" }, { number: "3" }, { number: "4" }]
              };
            }
            return null;
          }
        }
      });

      const res = await compareDevices(api, { deviceA: "OPAMP_A", deviceB: "DIFF_B" });
      expect(res.summary.dropInReplacement).toBe(false);
      expect(res.summary.pinoutMatch).toBe("incompatible");
      expect(res.recommendation).toContain("NOT a direct replacement");
    });
  });

  describe("verifyPinPadMapping", () => {
    it("validates all components in document and reports summary", async () => {
      const mockComp1 = {
        getState_Designator: () => "R1",
        getState_Title: () => "10k",
        getState_Footprint: () => "0805",
        getState_Pins: () => [{ getState_PinNumber: () => "1" }, { getState_PinNumber: () => "2" }]
      };
      const mockPcb1 = {
        getState_Designator: () => "R1",
        getState_Pads: () => [{ getState_PadNumber: () => "1" }, { getState_PadNumber: () => "2" }]
      };

      const api = () => ({
        dmt_SelectControl: {
          getCurrentDocumentInfo: async () => ({ documentType: 1, uuid: "sch-doc" })
        },
        sch_PrimitiveComponent: {
          getAll: async () => [mockComp1]
        },
        pcb_PrimitiveComponent: {
          getAll: async () => [mockPcb1]
        }
      });

      const res = await verifyPinPadMapping(api);
      expect(res.totalComponentsChecked).toBe(1);
      expect(res.perfectMatchesCount).toBe(1);
      expect(res.mismatchesCount).toBe(0);
      expect(res.verified).toBe(true);
      expect(res.components[0].complete).toBe(true);
      expect(res.components[0].severity).toBe("ok");
    });
  });
});
