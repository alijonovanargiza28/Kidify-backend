import mongoose from "mongoose";

export interface T {
  [key: string]: any;
}

export interface StatisticModifier {
  _id: mongoose.Types.ObjectId;
  targetKey: string;
  modifier: number;
}
