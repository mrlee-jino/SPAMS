import { notFound } from "next/navigation";
import { Workspace } from "@/components/workspace";
import { navigation } from "@/lib/simulation";
export function generateStaticParams() {
  return navigation
    .filter(([key]) => key !== "dashboard")
    .map(([section]) => ({ section }));
}
export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!navigation.some(([key]) => key === section)) notFound();
  return <Workspace section={section} />;
}
