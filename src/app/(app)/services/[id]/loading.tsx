import { SkeletonForm, SkeletonMeta, SkeletonPage, SkeletonPageHeader, SkeletonSection } from "@/components/ui/skeleton";

/** Shaped like a service's page (2026-11-16): header, the Profile form, Details. */
export default function ServiceLoading() {
  return (
    <SkeletonPage label="Loading service">
      <SkeletonPageHeader action />
      <SkeletonSection titleWidth={70}>
        <SkeletonForm fields={5} />
      </SkeletonSection>
      <SkeletonSection titleWidth={70}>
        <SkeletonMeta items={4} />
      </SkeletonSection>
    </SkeletonPage>
  );
}
