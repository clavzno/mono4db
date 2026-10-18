import type { Metadata } from "next";
import { RailwayDashboard } from "@/components/railway/railway-dashboard";

export const metadata: Metadata = { title: "Station Delay | Dutch Railway" };
export default function StationDelayPage() {
  return <RailwayDashboard initialReport="stations" />;
}
