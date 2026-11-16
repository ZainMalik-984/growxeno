import { SkeletonForm, SkeletonPage, SkeletonPageHeader, SkeletonSection } from "@/components/ui/skeleton";

/** Shaped like this New page (2026-11-16): header, then the form in one card. */
export default function NewLoading() {
  return (
    <SkeletonPage label="Loading new outsourced worker">
      <SkeletonPageHeader />
      <SkeletonSection titleWidth={0}>
        <SkeletonForm fields={5} textarea={true} />
      </SkeletonSection>
    </SkeletonPage>
  );
}
