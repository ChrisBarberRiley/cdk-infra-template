export type Stage = "dev" | "stg" | "prod";
export interface BaseProps {
  project: string;
  stage: Stage;
}
export const name = (base: string, p: BaseProps) =>
  `${p.project}-${p.stage}-${base}`;
