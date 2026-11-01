import { describe, expect, it } from "vitest";
import {
  parseSpecctraSes,
  parseEasyEdaRouterJson,
  parseEasyEdaLayoutJson,
  parseDxf,
  validateAndParseExternalContent,
  preparePcbExternalImportMutation,
  executePcbExternalImportMutation
} from "./pcbExternalImportMutations.js";
import { extensionMutations } from "./mutationManager.js";

const sampleSes = `
(session test_board
  (base_design "test.dsn")
  (routes
    (resolution mm 1000)
    (network
      (net GND
        (wire (path TopLayer 250 10000 20000 15000 20000 15000 30000))
        (via round_0.6 15000 30000)
      )
      (net VCC
        (wire (path BottomLayer 500 0 0 10000 10000))
      )
    )
  )
)
`;

const sampleRouterJson = JSON.stringify({
  routes: [
    {
      net: "NET_CLK",
      layer: 1,
      width: 0.2,
      points: [
        { x: 10, y: 10 },
        { x: 20, y: 10 },
        { x: 20, y: 30 }
      ]
    }
  ],
  vias: [
    {
      net: "NET_CLK",
      x: 20,
      y: 30,
      diameter: 0.6,
      hole: 0.3
    }
  ]
});

const sampleLayoutJson = JSON.stringify({
  placements: [
    { designator: "U1", x: 25.4, y: 30.0, rotation: 90, layer: 1 },
    { designator: "C1", x: 15.0, y: 30.0, rotation: 0, layer: 1 }
  ]
});

const sampleDxf = `
0
SECTION
2
HEADER
0
ENDSEC
0
SECTION
2
ENTITIES
0
LINE
8
Border
10
0.0
20
0.0
11
50.0
21
0.0
0
LINE
8
Border
10
50.0
20
0.0
11
50.0
21
30.0
0
LWPOLYLINE
8
Border
70
1
10
0.0
20
0.0
10
0.0
20
30.0
10
50.0
20
30.0
0
ENDSEC
0
EOF
`;

describe("pcbExternalImportMutations", () => {
  describe("parsers", () => {
    it("parses Specctra SES routing files with correct unit scale, wire segments and vias", () => {
      const parsed = parseSpecctraSes(sampleSes);
      expect(parsed.format).toBe("specctra_ses");
      expect(parsed.tracks).toHaveLength(3); // (10,20)->(15,20), (15,20)->(15,30), and (0,0)->(10,10)
      expect(parsed.vias).toHaveLength(1);
      expect(parsed.nets).toContain("GND");
      expect(parsed.nets).toContain("VCC");

      const gndTrack1 = parsed.tracks[0];
      expect(gndTrack1.net).toBe("GND");
      expect(gndTrack1.layer).toBe(1);
      expect(gndTrack1.startX).toBe(10);
      expect(gndTrack1.startY).toBe(20);
      expect(gndTrack1.endX).toBe(15);
      expect(gndTrack1.endY).toBe(20);
      expect(gndTrack1.width).toBe(0.25);

      const via = parsed.vias[0];
      expect(via.net).toBe("GND");
      expect(via.x).toBe(15);
      expect(via.y).toBe(30);
    });

    it("parses EasyEDA router JSON format", () => {
      const parsed = parseEasyEdaRouterJson(sampleRouterJson);
      expect(parsed.format).toBe("easyeda_router_json");
      expect(parsed.tracks).toHaveLength(2);
      expect(parsed.vias).toHaveLength(1);
      expect(parsed.nets).toEqual(["NET_CLK"]);
      expect(parsed.tracks[0].width).toBe(0.2);
    });

    it("parses EasyEDA layout JSON format", () => {
      const parsed = parseEasyEdaLayoutJson(sampleLayoutJson);
      expect(parsed.format).toBe("easyeda_layout_json");
      expect(parsed.placements).toHaveLength(2);
      expect(parsed.placements[0]).toMatchObject({
        designator: "U1",
        x: 25.4,
        y: 30.0,
        rotation: 90,
        layer: 1
      });
    });

    it("parses DXF lines and LWPOLYLINE geometries", () => {
      const parsed = parseDxf(sampleDxf, 10);
      expect(parsed.format).toBe("dxf");
      expect(parsed.lines.length).toBeGreaterThanOrEqual(4);
      expect(parsed.boundingBox.maxX).toBe(50.0);
      expect(parsed.boundingBox.maxY).toBe(30.0);
    });

    it("validates and rejects corrupt or unsupported formats", () => {
      expect(() => validateAndParseExternalContent("specctra_ses", "not a ses file")).toThrow(
        "Invalid Specctra SES content"
      );
      expect(() => validateAndParseExternalContent("easyeda_router_json", "{ invalid json")).toThrow(
        "Failed to parse EasyEDA router JSON"
      );
      expect(() => validateAndParseExternalContent("dxf", "not a dxf file")).toThrow("Invalid DXF content");
      expect(() => validateAndParseExternalContent("" as any, "something")).toThrow("Unsupported external format");
    });
  });

  describe("preparePcbExternalImportMutation", () => {
    const mockPcbDoc = {
      documentType: 3,
      uuid: "pcb-doc-1",
      parentProjectUuid: "project-1",
      tabId: "pcb@project-1"
    };

    it("performs dry run validation without staging a mutation", async () => {
      const api = () => ({
        dmt_SelectControl: {
          getCurrentDocumentInfo: async () => mockPcbDoc
        }
      });

      const res = await preparePcbExternalImportMutation(api, {
        format: "specctra_ses",
        content: sampleSes,
        dryRunOnly: true
      });

      expect(res.dryRun).toBe(true);
      expect(res.valid).toBe(true);
      expect(res.preview).toBeDefined();
      expect((res.preview as any).tracksToCreate).toBe(3);
    });

    it("stages a 2-phase mutation with preview and confirmation phrase", async () => {
      const api = () => ({
        dmt_SelectControl: {
          getCurrentDocumentInfo: async () => mockPcbDoc
        },
        pcb_PrimitiveTrack: {
          getAll: async () => [{ primitiveId: "trk-1" }]
        },
        pcb_PrimitiveVia: {
          getAll: async () => []
        },
        pcb_PrimitiveComponent: {
          getAll: async () => [{ primitiveId: "u1" }]
        }
      });

      const res = await preparePcbExternalImportMutation(api, {
        format: "specctra_ses",
        content: sampleSes
      });

      expect(res.action).toBe("import_external");
      expect(res.mutationId).toBeDefined();
      expect(res.confirmation).toBe(`CONFIRM pcb:import_external ${res.mutationId}`);
      expect((res.preview as any).tracksToCreate).toBe(3);
      expect((res.preview as any).viasToCreate).toBe(1);

      // Verify staged in manager
      const record = extensionMutations.get(String(res.mutationId));
      expect(record.action).toBe("import_external");
    });

    it("rejects non-PCB document targets", async () => {
      const api = () => ({
        dmt_SelectControl: {
          getCurrentDocumentInfo: async () => ({
            documentType: 1, // schematic
            uuid: "sch-1",
            parentProjectUuid: "p-1"
          })
        }
      });

      await expect(
        preparePcbExternalImportMutation(api, {
          format: "specctra_ses",
          content: sampleSes
        })
      ).rejects.toThrow("External import requires an active PCB document.");
    });
  });

  describe("executePcbExternalImportMutation", () => {
    it("executes track and via creation and validates readback", async () => {
      const createdTracks: any[] = [];
      const createdVias: any[] = [];
      let totalTracks = 0;
      let totalVias = 0;

      const api = () => ({
        pcb_PrimitiveTrack: {
          create: async (trk: any) => {
            createdTracks.push(trk);
            totalTracks++;
            return `trk-${totalTracks}`;
          },
          getAll: async () => Array.from({ length: totalTracks }, (_, i) => ({ primitiveId: `trk-${i}` }))
        },
        pcb_PrimitiveVia: {
          create: async (v: any) => {
            createdVias.push(v);
            totalVias++;
            return `via-${totalVias}`;
          },
          getAll: async () => Array.from({ length: totalVias }, (_, i) => ({ primitiveId: `via-${i}` }))
        }
      });

      const parsed = parseSpecctraSes(sampleSes);
      const res = await executePcbExternalImportMutation(
        api,
        {
          action: "import_external",
          parsedData: parsed
        },
        { totalTracks: 0, totalVias: 0 }
      );

      expect(res.executed).toBe(true);
      expect(res.readback.createdTracksCount).toBe(3);
      expect(res.readback.createdViasCount).toBe(1);
      expect(createdTracks[0].net).toBe("GND");
      expect(createdVias[0].net).toBe("GND");
    });

    it("throws readback_incomplete if created primitives are not reflected in readback", async () => {
      const api = () => ({
        pcb_PrimitiveTrack: {
          create: async () => undefined, // silent fail without returned id
          getAll: async () => [] // unchanged count
        },
        pcb_PrimitiveVia: {
          create: async () => undefined,
          getAll: async () => []
        }
      });

      const parsed = parseSpecctraSes(sampleSes);
      await expect(
        executePcbExternalImportMutation(
          api,
          { action: "import_external", parsedData: parsed },
          { totalTracks: 0, totalVias: 0 }
        )
      ).rejects.toThrow("Readback verification failed");
    });

    it("throws api_unavailable if track create method is not available", async () => {
      const api = () => ({}); // no pcb_PrimitiveTrack
      const parsed = parseSpecctraSes(sampleSes);

      await expect(
        executePcbExternalImportMutation(api, { action: "import_external", parsedData: parsed })
      ).rejects.toThrow("PCB track creation API (pcb_PrimitiveTrack.create) is unavailable.");
    });
  });
});
