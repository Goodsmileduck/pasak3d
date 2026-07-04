import type { Connector, ConnectorCategory } from "./types";
import { m1KeyedConnectors } from "./m1-adapter";

export const DEFAULT_CONNECTOR_ID = "cylinder";

const ALL: Connector[] = [...m1KeyedConnectors()];

export const CONNECTORS: Record<string, Connector> = Object.fromEntries(ALL.map((c) => [c.id, c]));

export function getConnector(id: string): Connector | undefined {
  return CONNECTORS[id];
}

export function listByCategory(cat: ConnectorCategory): Connector[] {
  return ALL.filter((c) => c.category === cat);
}
