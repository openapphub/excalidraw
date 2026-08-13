import "csstype";

declare module "csstype" {
  interface Properties<
    TLength = (string & {}) | 0,
    TTime = string & {},
  > {
    "--max-width"?: number | string;
    "--swatch-color"?: string;
    "--gap"?: number | string;
    "--padding"?: number | string;
  }
}
