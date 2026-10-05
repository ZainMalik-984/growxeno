import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Breadcrumbs, MetaList, PageHeader, Section } from "@/components/ui/page";
import { StatusDot } from "@/components/ui/status-dot";
import { listAssignableCategories } from "@/lib/categories/queries";
import { requirePermission } from "@/lib/auth/authorize";
import { getServiceDetail } from "@/lib/services/queries";
import { ServiceActions } from "./service-actions";
import { ServiceProfileForm } from "./service-profile-form";

export const metadata: Metadata = { title: "Service" };

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export default async function ServiceDetailPage({ params }: PageProps<"/services/[id]">) {
  const actor = await requirePermission("services.view");
  const { id } = await params;

  const service = await getServiceDetail(id);
  if (!service) notFound();

  const canEdit = actor.permissions.has("services.edit");
  const canDelete = actor.permissions.has("services.delete");
  const categories = canEdit ? await listAssignableCategories() : [];

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Services" },
          { label: "Services", href: "/services" },
          { label: service.name },
        ]}
      />

      <PageHeader
        title={service.name}
        description={service.category.name}
        actions={
          canEdit || canDelete ? (
            <ServiceActions
              serviceId={service.id}
              name={service.name}
              isActive={service.isActive}
              canEdit={canEdit}
              canDelete={canDelete}
            />
          ) : undefined
        }
      />

      {!service.isActive ? (
        <div className="mb-10 border-l-2 border-zinc-400 pl-4">
          <p className="text-[13px] font-medium text-ink">This service is deactivated</p>
          <p className="mt-1 text-[13px] text-ink-muted">
            It no longer appears in active service pickers. Reactivate it to offer it again.
          </p>
        </div>
      ) : null}

      <Section title="Profile">
        <ServiceProfileForm service={service} categories={categories} canEdit={canEdit} />
      </Section>

      <Section title="Details">
        <MetaList
          items={[
            {
              label: "Status",
              value: (
                <StatusDot
                  tone={service.isActive ? "done" : "neutral"}
                  label={service.isActive ? "Active" : "Inactive"}
                />
              ),
            },
            { label: "Created", value: `${dateFormat.format(service.createdAt)} UTC` },
            { label: "Updated", value: `${dateFormat.format(service.updatedAt)} UTC` },
          ]}
        />
      </Section>
    </>
  );
}
