import { notFound } from "next/navigation";
import { nodes } from "@/lib/simulation";
import { Workspace } from "@/components/workspace";
export function generateStaticParams() {
  return nodes.map(({ id }) => ({ id }));
}
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!nodes.some((n) => n.id === id)) notFound();
  return <Workspace section="node-detail" nodeId={id} />;
}
