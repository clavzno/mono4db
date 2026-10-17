import type { Metadata } from "next";
import { RailwayDashboard } from "@/components/railway/railway-dashboard";

export const metadata: Metadata = { title: "On-time Trends | Dutch Railway" };

export default function OnTimeTrendsPage() {
  return <RailwayDashboard onTimeReport />;
}
