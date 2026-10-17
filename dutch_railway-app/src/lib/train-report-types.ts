export type TrainRow = {
  trainId: string;
  rate: number;
  averageDelay: number;
  gap: number;
};

export type TrainReport = {
  companyName: string;
  requestedLimit: number;
  companyOnTimeRate: number | null;
  rows: TrainRow[];
};
