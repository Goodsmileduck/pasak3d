import type { Joint, TolerancePreset } from "../../../types";
import { resolveClearance } from "../../../types";

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

export function resolveConnectorParams(joint: Joint, preset: TolerancePreset): ConnectorParams {
  return {
    size: joint.diameter,
    length: joint.length,
    taper: joint.taper,
    clearance: resolveClearance(joint, preset),
  };
}
