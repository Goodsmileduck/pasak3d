import type { Joint, TolerancePreset } from "../../../types";
import { TOLERANCE_VALUES } from "../../../types";

export type ConnectorCategory = "keyed" | "snap";
export type AssemblyModel = "separate-piece" | "integral";

export type ConnectorParams = {
  size: number;
  length: number;
  taper?: number;
  clearance: number;
};

export type ConnectorBuild = {
  femaleCavity(M: any, p: ConnectorParams): any;
  piece(M: any, p: ConnectorParams): any | null;
  integralMale?(M: any, p: ConnectorParams): any | null;
};

export type Connector = {
  id: string;
  name: string;
  category: ConnectorCategory;
  assembly: AssemblyModel;
  defaults: Partial<ConnectorParams>;
  build: ConnectorBuild;
  describe: string;
};

/**
 * Build params for a connector on a placed joint. Clearance precedence:
 * per-joint override → the connector's own default → the tolerance preset. Snap
 * connectors depend on their tuned default (a preset value is far too tight to flex).
 */
export function resolveConnectorParams(
  joint: Joint,
  connector: Connector,
  preset: TolerancePreset,
): ConnectorParams {
  return {
    size: joint.diameter,
    length: joint.length,
    taper: joint.taper,
    clearance: joint.clearance ?? connector.defaults.clearance ?? TOLERANCE_VALUES[preset],
  };
}
