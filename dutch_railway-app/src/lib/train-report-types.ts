export type TrainRow = {
  trainId: string;
  rate: number;
  averageDelay: number;
  gap: number;
};

export type TrainReport = {
  companyName: string;
  requestedLimit: number;
  from: string;
  to: string;
  companyAverageDelay: number | null;
  rows: TrainRow[];
};
