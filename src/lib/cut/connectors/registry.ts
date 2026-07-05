import type { Connector, ConnectorCategory } from "./types";
import { tSlotConnector } from "./keyed/t-slot";
import { m1KeyedConnectors } from "./m1-adapter";
import { cantileverClipConnector } from "./snap/cantilever-clip";
import { snapDovetailConnector } from "./snap/snap-dovetail";
import { snapKeyConnector } from "./snap/snap-key";
import { snapPinConnector } from "./snap/snap-pin";
import type { JointShape } from "../../../types";
import { JOINT_SHAPES } from "../../../types";

export const DEFAULT_CONNECTOR_ID = "cylinder";

/** True when a connector id is one of the legacy M1 shapes (id === JointShape). */
export function isM1Shape(id: string): id is JointShape {
  return (JOINT_SHAPES as readonly string[]).includes(id);
}

const ALL: Connector[] = [
  ...m1KeyedConnectors(),
  tSlotConnector,
  snapPinConnector,
  snapDovetailConnector,
  snapKeyConnector,
  cantileverClipConnector,
];

export const CONNECTORS: Record<string, Connector> = Object.fromEntries(ALL.map((c) => [c.id, c]));

export function getConnector(id: string): Connector | undefined {
  return CONNECTORS[id];
}

export function listByCategory(cat: ConnectorCategory): Connector[] {
  return ALL.filter((c) => c.category === cat);
}
