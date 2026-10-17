import type { Metadata } from "next";
import { RailwayDashboard } from "@/components/railway/railway-dashboard";

export const metadata: Metadata = { title: "Underperforming Trains | Dutch Railway" };

export default function UnderperformingTrainsPage() {
  return <RailwayDashboard initialReport="trains" />;
}
