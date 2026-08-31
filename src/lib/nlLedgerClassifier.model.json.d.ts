export type NlLedgerClassifierModel = {
  version: number;
  nMin: number;
  nMax: number;
  classes: string[];
  vocab: string[];
  idf: number[];
  bias: number[];
  weights: number[][];
  keywords: [string, string[]][];
};

declare const model: NlLedgerClassifierModel;
export default model;
