import { apiError, ensureApi, sanitize, timestamp, toArray } from "../helpers.js";
import type { EasyEdaApi, RpcHandler } from "../types.js";

export function extractFile(value: unknown): unknown {
  if (typeof File !== "undefined" && value instanceof File) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.find((item) => typeof File !== "undefined" && item instanceof File) ?? value[0];
  }
  if (value && typeof value === "object" && "file" in value) {
    return (value as { file: unknown }).file;
  }
  return value;
}

export function pickManufactureApi(api: () => EasyEdaApi, scope: string | undefined, method: string): any {
  const eda = api();
  if (scope === "schematic") {
    ensureApi("sch_ManufactureData", method, eda);
    return eda.sch_ManufactureData;
  }
  if (scope === "pcb") {
    ensureApi("pcb_ManufactureData", method, eda);
    return eda.pcb_ManufactureData;
  }
  if (eda.pcb_ManufactureData?.[method]) {
    return eda.pcb_ManufactureData;
  }
  ensureApi("sch_ManufactureData", method, eda);
  return eda.sch_ManufactureData;
}

export async function saveApiFile(
  api: () => EasyEdaApi,
  file: unknown,
  fallbackFileName: string,
  betaApi: boolean
): Promise<Record<string, unknown>> {
  const eda = api();
  const normalizedFile = extractFile(file);
  if (!normalizedFile) {
    return {
      saved: false,
      file: sanitize(file),
      reason: "EasyEDA returned a non-File value; returning it without saving.",
      betaApi
    };
  }

  ensureApi("sys_FileSystem", "saveFile", eda);
  const fileName = (normalizedFile as File).name || fallbackFileName;
  const saveResult = await eda.sys_FileSystem.saveFile(normalizedFile, fileName);
  return {
    saved: true,
    fileName,
    saveResult: sanitize(saveResult),
    betaApi
  };
}

export function createExportHandlers(api: () => EasyEdaApi): Record<string, RpcHandler> {
  async function exportBom(params: Record<string, any>): Promise<Record<string, unknown>> {
    const fileName = params.fileName ?? `easyeda-bom-${timestamp()}`;
    const format = params.format ?? "csv";
    const mfgApi = pickManufactureApi(api, params.scope, "getBomFile");
    const file = await mfgApi.getBomFile(fileName, format);
    return saveApiFile(api, file, `${fileName}.${format}`, true);
  }

  async function exportNetlist(params: Record<string, any>): Promise<Record<string, unknown>> {
    const fileName = params.fileName ?? `easyeda-netlist-${timestamp()}`;
    const mfgApi = pickManufactureApi(api, params.scope, "getNetlistFile");
    const file = await mfgApi.getNetlistFile(fileName, params.netlistType);
    return saveApiFile(api, file, `${fileName}.net`, true);
  }

  async function exportGerber(params: Record<string, any>): Promise<Record<string, unknown>> {
    const eda = api();
    ensureApi("pcb_ManufactureData", "getGerberFile", eda);
    const fileName = params.fileName ?? `easyeda-gerber-${timestamp()}`;
    const file = await eda.pcb_ManufactureData.getGerberFile(fileName);
    return saveApiFile(api, file, `${fileName}.zip`, true);
  }

  async function exportPdf(params: Record<string, any>): Promise<Record<string, unknown>> {
    const eda = api();
    const fileName = params.fileName ?? `easyeda-export-${timestamp()}`;
    if (
      params.scope === "schematic" ||
      (!eda.pcb_ManufactureData?.getPdfFile && eda.sch_ManufactureData?.getExportDocumentFile)
    ) {
      const file = await eda.sch_ManufactureData.getExportDocumentFile(fileName, "pdf");
      return saveApiFile(api, file, `${fileName}.pdf`, true);
    }
    ensureApi("pcb_ManufactureData", "getPdfFile", eda);
    const file = await eda.pcb_ManufactureData.getPdfFile(fileName);
    return saveApiFile(api, file, `${fileName}.pdf`, true);
  }

  async function exportCpl(params: Record<string, any>): Promise<Record<string, unknown>> {
    const eda = api();
    ensureApi("pcb_ManufactureData", "getPickAndPlaceFile", eda);
    const fileName = params.fileName ?? `easyeda-cpl-${timestamp()}`;
    const format = params.format ?? "csv";
    const unit = params.unit ?? "mm";
    const file = await eda.pcb_ManufactureData.getPickAndPlaceFile(fileName, format, unit);
    return saveApiFile(api, file, `${fileName}.${format}`, true);
  }

  async function searchLibrary(params: Record<string, any>): Promise<Record<string, unknown>> {
    const eda = api();
    const query = String(params.query ?? "").trim();
    if (!query) {
      throw apiError("missing_query", "query parameter is required to search the component library.");
    }
    const limit = Math.max(1, Math.min(100, Number(params.limit ?? 20)));

    let rawResults: unknown;
    if (eda.lib_Device?.search) {
      rawResults = await eda.lib_Device.search(query);
    } else if (eda.lib_Search?.search) {
      rawResults = await eda.lib_Search.search(query);
    } else {
      throw apiError("api_unavailable", "eda.lib_Device.search is unavailable in this EasyEDA Pro environment.");
    }

    const list = toArray(rawResults);
    const results = list.slice(0, limit).map((item: any) => {
      if (!item || typeof item !== "object") return item;
      return {
        uuid: item.uuid ?? item.id,
        name: item.name ?? item.title,
        lcscCode: item.lcscCode ?? item.code ?? item.orderCode ?? item.partNumber,
        deviceType: item.deviceType ?? item.type,
        package: item.package ?? item.footprint ?? item.packageName,
        manufacturer: item.manufacturer ?? item.mfr,
        description: item.description ?? item.comment,
        inStock: item.inStock ?? item.stock,
        isJlcBasic: item.isJlcBasic ?? item.basicPart
      };
    });

    return {
      query,
      count: results.length,
      total: list.length,
      results: sanitize(results),
      raw: sanitize(list.slice(0, limit))
    };
  }

  return {
    exportBom,
    exportNetlist,
    exportGerber,
    exportPdf,
    exportCpl,
    searchLibrary
  };
}
