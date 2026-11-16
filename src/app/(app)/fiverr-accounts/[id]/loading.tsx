import { SkeletonForm, SkeletonList, SkeletonPage, SkeletonPageHeader, SkeletonSection } from "@/components/ui/skeleton";

/** Shaped like a Fiverr account's page (2026-11-16): header, the Account form, its gigs. */
export default function FiverrAccountLoading() {
  return (
    <SkeletonPage label="Loading Fiverr account">
      <SkeletonPageHeader action />
      <SkeletonSection titleWidth={80}>
        <SkeletonForm fields={4} />
      </SkeletonSection>
      <SkeletonSection titleWidth={50}>
        <SkeletonList rows={3} />
      </SkeletonSection>
    </SkeletonPage>
  );
}
