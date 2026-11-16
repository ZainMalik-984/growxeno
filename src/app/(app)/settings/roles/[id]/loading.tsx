import { SkeletonList, SkeletonMeta, SkeletonPage, SkeletonPageHeader, SkeletonSection } from "@/components/ui/skeleton";

/** Shaped like a role's page (2026-11-16): header, Details, permissions, users with the role. */
export default function RoleLoading() {
  return (
    <SkeletonPage label="Loading role">
      <SkeletonPageHeader action />
      <SkeletonSection titleWidth={70}>
        <SkeletonMeta items={4} />
      </SkeletonSection>
      <SkeletonSection titleWidth={110}>
        <SkeletonList rows={5} />
      </SkeletonSection>
      <SkeletonSection titleWidth={150}>
        <SkeletonList rows={3} />
      </SkeletonSection>
    </SkeletonPage>
  );
}
