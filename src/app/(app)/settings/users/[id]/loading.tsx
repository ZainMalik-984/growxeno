import { SkeletonList, SkeletonMeta, SkeletonPage, SkeletonPageHeader, SkeletonSection } from "@/components/ui/skeleton";

/** Shaped like a user's page in Settings (2026-11-16): header, Profile, roles, permissions. */
export default function UserLoading() {
  return (
    <SkeletonPage label="Loading user">
      <SkeletonPageHeader action />
      <SkeletonSection titleWidth={70}>
        <SkeletonMeta items={4} />
      </SkeletonSection>
      <SkeletonSection titleWidth={60}>
        <SkeletonList rows={3} />
      </SkeletonSection>
      <SkeletonSection titleWidth={110}>
        <SkeletonList rows={4} />
      </SkeletonSection>
    </SkeletonPage>
  );
}
