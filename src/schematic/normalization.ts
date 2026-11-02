import type { Position, SchematicComponent, SchematicLabel, SchematicPin, SchematicWire, Segment } from "./types.js";

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function compactRaw(value: unknown): unknown {
  if (!value || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 40).map(compactRaw);
  }
  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>).slice(0, 80)) {
    if (typeof item !== "function") {
      output[key] = item && typeof item === "object" ? compactRaw(item) : item;
    }
  }
  return output;
}

export function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : typeof value === "number"
      ? String(value)
      : undefined;
}

export function normalizeNetName(value: unknown): string | undefined {
  const text = stringValue(value);
  return text && text !== "?" ? text : undefined;
}

export function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function sameText(left: unknown, right: unknown): boolean {
  return stringValue(left)?.toLowerCase() === stringValue(right)?.toLowerCase();
}

export function isPresent<T>(value: T | undefined): value is T {
  return value !== undefined;
}

export function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

export function intersects(left: string[], right: string[]): boolean {
  const rightSet = new Set(right);
  return left.some((item) => rightSet.has(item));
}

export function uniqueByPrimitiveId<T extends { primitiveId?: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const output: T[] = [];
  for (const item of items) {
    const key = item.primitiveId ?? JSON.stringify(item);
    if (!seen.has(key)) {
      seen.add(key);
      output.push(item);
    }
  }
  return output;
}

export function requiredPosition(position: Position): Required<Position> | undefined {
  return position.x !== undefined && position.y !== undefined ? { x: position.x, y: position.y } : undefined;
}

export function distance(left: Required<Position>, right: Required<Position>): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

export function extractSegments(value: unknown): Segment[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const segments: Segment[] = [];
  // EasyEDA returns both flat polylines and arrays of independent polylines.
  // Never join the end of one independent path to the start of another.
  if (value.some((item) => typeof item === "number")) {
    if (value.length < 4 || value.length % 2 !== 0 || !value.every((item) => numberValue(item) !== undefined)) {
      return [];
    }
    for (let index = 2; index < value.length; index += 2) {
      segments.push({
        start: { x: value[index - 2], y: value[index - 1] },
        end: { x: value[index], y: value[index + 1] }
      });
    }
    return segments;
  }
  let previousPoint: Required<Position> | undefined;
  for (const item of value) {
    if (Array.isArray(item) && item.length >= 4) {
      previousPoint = undefined;
      segments.push(...extractSegments(item));
      continue;
    }
    const point = Array.isArray(item)
      ? requiredPosition({ x: numberValue(item[0]), y: numberValue(item[1]) })
      : requiredPosition({ x: numberValue(asRecord(item).x), y: numberValue(asRecord(item).y) });
    if (point && previousPoint) {
      segments.push({ start: previousPoint, end: point });
    }
    previousPoint = point;
  }
  return segments;
}

export function inferEndpoints(value: unknown): Position[] | undefined {
  const segments = extractSegments(value);
  if (segments.length === 0) {
    return undefined;
  }
  return [segments[0].start, segments[segments.length - 1].end];
}

export function pointTouchesSegment(point: Required<Position>, segment: Segment, tolerance: number): boolean {
  const minX = Math.min(segment.start.x, segment.end.x) - tolerance;
  const maxX = Math.max(segment.start.x, segment.end.x) + tolerance;
  const minY = Math.min(segment.start.y, segment.end.y) - tolerance;
  const maxY = Math.max(segment.start.y, segment.end.y) + tolerance;
  if (point.x < minX || point.x > maxX || point.y < minY || point.y > maxY) {
    return false;
  }
  const dx = segment.end.x - segment.start.x;
  const dy = segment.end.y - segment.start.y;
  const length = Math.hypot(dx, dy);
  if (length <= tolerance) {
    return distance(point, segment.start) <= tolerance;
  }
  const cross = Math.abs((point.x - segment.start.x) * dy - (point.y - segment.start.y) * dx);
  return cross / length <= tolerance;
}

export function segmentTouchesSegment(left: Segment, right: Segment, tolerance: number): boolean {
  return (
    pointTouchesSegment(left.start, right, tolerance) ||
    pointTouchesSegment(left.end, right, tolerance) ||
    pointTouchesSegment(right.start, left, tolerance) ||
    pointTouchesSegment(right.end, left, tolerance)
  );
}

export function segmentsTouch(left: Segment[], right: Segment[], tolerance: number): boolean {
  return left.some((leftSegment) =>
    right.some((rightSegment) => segmentTouchesSegment(leftSegment, rightSegment, tolerance))
  );
}

export function labelTouchesSegments(label: SchematicLabel, segments: Segment[], tolerance: number): boolean {
  const point = requiredPosition(label.position);
  if (!point) {
    return false;
  }
  const candidates = [point, { x: point.x, y: -point.y }];
  return candidates.some((candidate) => segments.some((segment) => pointTouchesSegment(candidate, segment, tolerance)));
}

export function looksLikePowerPin(pin: SchematicPin): boolean {
  const text = `${pin.pinName ?? ""} ${pin.pinNumber ?? ""}`.toUpperCase();
  return /\b(VCC|VDD|VIN|VBUS|GND|VSS|AVDD|DVDD|3V3|5V)\b/.test(text);
}

export function looksLikePowerNet(name: string): boolean {
  return /(^|\b)(GND|VCC|VDD|VIN|VBUS|3V3|5V|BAT|VBAT|POWER)(\b|$)/i.test(name);
}

export function looksLikeNetName(text: string): boolean {
  return /^[A-Za-z0-9_+\-./:]+$/.test(text) && /[A-Za-z0-9]/.test(text);
}

export function looksLikeExplicitTextNetName(text: string): boolean {
  if (!looksLikeNetName(text)) {
    return false;
  }
  if (/\s/.test(text)) {
    return false;
  }
  if (/^(pull-?up|pull-?down|gpio|usb_c|buck|charger|batt)$/i.test(text)) {
    return false;
  }
  return /[_+\-./:]|\d|^(GND|VCC|VDD|VIN|VBUS|VBAT|BAT|SDA|SCL|MISO|MOSI|SCK|RX|TX|D\+|D-)$/i.test(text);
}

export function canonicalNet(name: string): string {
  return name.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function formatPin(pin: SchematicPin): string {
  const designator = pin.componentDesignator ?? "unknown component";
  const number = pin.pinNumber ? `#${pin.pinNumber}` : "";
  const name = pin.pinName ? ` ${pin.pinName}` : "";
  return `${designator}${number}${name}`.trim();
}

export function pinEvidence(pin: SchematicPin): Record<string, unknown> {
  return {
    component: pin.componentDesignator,
    pinNumber: pin.pinNumber,
    pinName: pin.pinName,
    net: pin.net,
    nodeId: pin.nodeId,
    connected: pin.connected,
    position: pin.position,
    primitiveId: pin.primitiveId
  };
}

export function netNodeId(net: string): string {
  // Keep significant punctuation: USB_D+ and USB_D- are different nodes.
  return `net:${net}`;
}

export function normalizeComponent(raw: unknown, includeRaw: boolean): SchematicComponent {
  const item = asRecord(raw);
  const otherProperty = asRecord(item.otherProperty);
  return {
    primitiveId: stringValue(item.primitiveId ?? item.id ?? item.uuid),
    designator: stringValue(item.designator ?? item.prefix ?? item.name),
    value: stringValue(item.value ?? otherProperty.Value ?? item.comment),
    name: stringValue(item.name ?? item.subPartName ?? item.title),
    componentType: stringValue(item.componentType ?? item.primitiveType),
    footprint: item.footprint,
    manufacturer: stringValue(item.manufacturer ?? otherProperty.Manufacturer),
    manufacturerId: stringValue(item.manufacturerId ?? otherProperty["Manufacturer Part"]),
    position: {
      x: numberValue(item.x),
      y: numberValue(item.y)
    },
    raw: includeRaw ? compactRaw(item) : undefined
  };
}

export function normalizePin(
  raw: unknown,
  componentPrimitiveId: string,
  componentDesignator: string | undefined,
  includeRaw: boolean
): SchematicPin {
  const item = asRecord(raw);
  const net = normalizeNetName(item.net ?? item.netName ?? item.network);
  return {
    primitiveId: stringValue(item.primitiveId ?? item.id ?? item.uuid),
    componentPrimitiveId,
    componentDesignator: stringValue(item.componentDesignator ?? item.designator ?? componentDesignator),
    pinNumber: stringValue(item.pinNumber ?? item.number ?? item.num ?? item.no),
    pinName: stringValue(item.pinName ?? item.name ?? item.label ?? item.displayName),
    net,
    netSource: net ? "direct" : "unknown",
    connectivityEvidence: net
      ? {
          source: "direct",
          confidence: "high",
          net,
          reason: "EasyEDA returned a net directly on the pin."
        }
      : {
          source: "unknown",
          confidence: "low",
          reason: "No direct net was returned for this pin."
        },
    position: {
      x: numberValue(item.x),
      y: numberValue(item.y)
    },
    raw: includeRaw ? compactRaw(item) : undefined
  };
}

export function normalizeWire(raw: unknown, includeRaw: boolean): SchematicWire {
  const item = asRecord(raw);
  const line = item.line;
  const geometry = line ?? item.points ?? item.geometry;
  // Native Wire.line readback packs independent segments as x1,y1,x2,y2.
  // Joining consecutive segments introduces artificial paths between their ends.
  const normalizedGeometry =
    Array.isArray(line) &&
    line.length > 0 &&
    line.length % 4 === 0 &&
    line.every((coordinate: unknown) => numberValue(coordinate) !== undefined)
      ? Array.from({ length: line.length / 4 }, (_, index) => line.slice(index * 4, index * 4 + 4))
      : geometry;
  return {
    primitiveId: stringValue(item.primitiveId ?? item.id ?? item.uuid),
    net: normalizeNetName(item.net ?? item.netName),
    geometry: normalizedGeometry,
    endpoints: inferEndpoints(normalizedGeometry),
    raw: includeRaw ? compactRaw(item) : undefined
  };
}

export function normalizeComponentLabel(raw: unknown, includeRaw: boolean): SchematicLabel[] {
  const item = asRecord(raw);
  const componentType = stringValue(item.componentType ?? item.primitiveType);
  const net = normalizeNetName(item.net ?? item.netName);
  if (!net || !componentType || !["netflag", "netport", "short_symbol"].includes(componentType)) {
    return [];
  }
  return [
    {
      primitiveId: stringValue(item.primitiveId ?? item.id ?? item.uuid),
      net,
      type: componentType,
      position: {
        x: numberValue(item.x),
        y: numberValue(item.y)
      },
      raw: includeRaw ? compactRaw(item) : undefined
    }
  ];
}

export function normalizeTextLabel(raw: unknown, includeRaw: boolean): SchematicLabel[] {
  const item = asRecord(raw);
  const text = stringValue(item.text ?? item.content ?? item.value);
  if (!text || !looksLikeExplicitTextNetName(text)) {
    return [];
  }
  return [
    {
      primitiveId: stringValue(item.primitiveId ?? item.id ?? item.uuid),
      net: text,
      type: "text",
      position: {
        x: numberValue(item.x),
        y: numberValue(item.y)
      },
      raw: includeRaw ? compactRaw(item) : undefined
    }
  ];
}
