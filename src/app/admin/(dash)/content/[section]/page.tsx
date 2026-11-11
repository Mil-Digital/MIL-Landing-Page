import { notFound } from "next/navigation";
import { getSection } from "@/content/schema";
import { SectionEditor } from "@/components/admin/SectionEditor";

export default async function Page({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!getSection(section)) notFound();
  return <SectionEditor key={section} sectionId={section} />;
}
