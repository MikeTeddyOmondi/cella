import { onlineManager } from '@tanstack/react-query';
import { forwardRef, useImperativeHandle, useMemo } from 'react';

import { Bird } from 'lucide-react';
import type { RowsChangeData } from 'react-data-grid';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { inviteMembers } from '~/api/memberships';
import { useDataFromSuspenseInfiniteQuery } from '~/hooks/use-data-from-query';
import ContentPlaceholder from '~/modules/common/content-placeholder';
import { DataTable } from '~/modules/common/data-table';
import { dialog } from '~/modules/common/dialoger/state';

import { useMutateQueryData } from '~/hooks/use-mutate-query-data';
import { showToast } from '~/lib/toasts';
import { SheetNav } from '~/modules/common/sheet-nav';
import { sheet } from '~/modules/common/sheeter/state';
import DeleteOrganizations from '~/modules/organizations/delete-organizations';
import type { OrganizationsSearch, OrganizationsTableMethods } from '~/modules/organizations/organizations-table';
import { organizationsQueryOptions } from '~/modules/organizations/organizations-table/helpers/query-options';
import NewsletterDraft from '~/modules/system/newsletter-draft';
import OrganizationsNewsletterForm from '~/modules/system/organizations-newsletter-form';
import { useUserStore } from '~/store/user';
import type { BaseTableProps, BaseTableQueryVariables, Organization } from '~/types/common';

type BaseOrganizationsTableProps = BaseTableProps<Organization> & {
  queryVars: BaseTableQueryVariables<OrganizationsSearch>;
};

const BaseOrganizationsTable = forwardRef<OrganizationsTableMethods, BaseOrganizationsTableProps>(
  ({ tableId, columns, sortColumns, setSortColumns, queryVars }: BaseOrganizationsTableProps, ref) => {
    const { t } = useTranslation();
    const { user } = useUserStore();
    const { q, sort, order, limit } = queryVars;

    const mutateQuery = useMutateQueryData(['organizations', 'list']);

    // Query organizations
    const { rows, selectedRows, setRows, setSelectedRows, totalCount, isLoading, isFetching, error, fetchNextPage } =
      useDataFromSuspenseInfiniteQuery(organizationsQueryOptions({ q, sort, order, limit }));

    // Table selection
    const selectedOrganizations = useMemo(() => {
      return rows.filter((row) => selectedRows.has(row.id));
    }, [rows, selectedRows]);

    const onRowsChange = async (changedRows: Organization[], { column, indexes }: RowsChangeData<Organization>) => {
      if (!onlineManager.isOnline()) return showToast(t('common:action.offline.text'), 'warning');

      if (column.key !== 'userRole') return setRows(changedRows);

      // If user role is changed, invite user to organization
      for (const index of indexes) {
        const organization = changedRows[index];
        if (!organization.membership?.role) continue;

        inviteMembers({
          idOrSlug: organization.id,
          emails: [user.email],
          role: organization.membership?.role,
          entityType: 'organization',
          organizationId: organization.id,
        })
          .then(() => toast.success(t('common:success.role_updated')))
          .catch(() => toast.error(t('common:error.error')));
      }

      setRows(changedRows);
    };

    const openRemoveDialog = () => {
      dialog(
        <DeleteOrganizations
          organizations={selectedOrganizations}
          callback={(organizations) => {
            showToast(t('common:success.delete_resources', { resources: t('common:organizations') }), 'success');
            mutateQuery.remove(organizations);
          }}
          dialog
        />,
        {
          drawerOnMobile: false,
          className: 'max-w-xl',
          title: t('common:delete'),
          description: t('common:confirm.delete_resources', { resources: t('common:organizations').toLowerCase() }),
        },
      );
    };

    const openNewsletterSheet = () => {
      const newsletterTabs = [
        {
          id: 'write',
          label: 'common:write',
          element: (
            <OrganizationsNewsletterForm
              sheet
              organizationIds={selectedOrganizations.map((o) => o.id)}
              dropSelectedOrganization={() => setSelectedRows(new Set<string>())}
            />
          ),
        },

        {
          id: 'draft',
          label: 'common:draft',
          element: <NewsletterDraft />,
        },
      ];
      sheet.create(<SheetNav tabs={newsletterTabs} />, {
        className: 'max-w-full lg:max-w-4xl',
        title: t('common:newsletter'),
        description: t('common:newsletter.text'),
        id: 'newsletter-form',
        scrollableOverlay: true,
        side: 'right',
      });
    };

    // Expose methods via ref using useImperativeHandle
    useImperativeHandle(ref, () => ({
      clearSelection: () => setSelectedRows(new Set<string>()),
      openRemoveDialog,
      openNewsletterSheet,
    }));

    return (
      <div id={tableId} data-total-count={totalCount} data-selected={selectedOrganizations.length}>
        {/* Table */}
        <DataTable<Organization>
          {...{
            columns: columns.filter((column) => column.visible),
            rows,
            totalCount,
            rowHeight: 42,
            rowKeyGetter: (row) => row.id,
            error,
            isLoading,
            isFetching,
            enableVirtualization: false,
            isFiltered: !!q,
            limit,
            selectedRows,
            onRowsChange,
            fetchMore: fetchNextPage,
            onSelectedRowsChange: setSelectedRows,
            sortColumns,
            onSortColumnsChange: setSortColumns,
            NoRowsComponent: (
              <ContentPlaceholder Icon={Bird} title={t('common:no_resource_yet', { resource: t('common:organizations').toLowerCase() })} />
            ),
          }}
        />
      </div>
    );
  },
);

export default BaseOrganizationsTable;
