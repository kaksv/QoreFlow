import type { Metadata } from "next";
import { StreamDetail } from "@/components/streams/stream-detail";

export const metadata: Metadata = {
  title: "Stream detail",
};

export default async function StreamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <StreamDetail id={id} />;
}
