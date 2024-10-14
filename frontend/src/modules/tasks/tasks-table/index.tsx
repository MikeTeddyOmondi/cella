import { type Edge, extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine';
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { infiniteQueryOptions, useInfiniteQuery } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { Bird } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { SortColumn } from 'react-data-grid';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { z } from 'zod';
import { type GetTasksParams, getTasksList } from '~/api/tasks';
import { useHotkeys } from '~/hooks/use-hot-keys';
import useSaveInSearchParams from '~/hooks/use-save-in-search-params';
import { queryClient } from '~/lib/router';
import ContentPlaceholder from '~/modules/common/content-placeholder';
import { DataTable } from '~/modules/common/data-table';
import ColumnsView from '~/modules/common/data-table/columns-view';
import Export from '~/modules/common/data-table/export.tsx';
import { getInitialSortColumns } from '~/modules/common/data-table/sort-columns';

import TableHeader from '~/modules/app/board-header';
import { isSubtaskData } from '~/modules/app/board/helpers';
import { openUserPreviewSheet } from '~/modules/common/data-table/util';
import { dropdowner } from '~/modules/common/dropdowner/state';
import { taskKeys, useTaskMutation } from '~/modules/common/query-client-provider/tasks';
import { sheet } from '~/modules/common/sheeter/state';
import { configureForExport, getRelativeTaskOrder, handleTaskDropDownClick, openTaskPreviewSheet } from '~/modules/tasks/helpers';
import TaskCard from '~/modules/tasks/task';
import { useColumns } from '~/modules/tasks/tasks-table/columns';
import { useWorkspaceQuery } from '~/modules/workspaces/helpers/use-workspace';
import { WorkspaceTableRoute, type tasksSearchSchema } from '~/routes/workspaces';
import { useThemeStore } from '~/store/theme';
import { useWorkspaceStore } from '~/store/workspace';
import type { Task } from '~/types/app';

type TasksSearch = z.infer<typeof tasksSearchSchema>;

const tasksQueryOptions = ({
  q,
  sort: initialSort,
  order: initialOrder,
  limit = 2000,
  projectId,
  status,
  rowsLength = 0,
  orgIdOrSlug,
}: GetTasksParams & {
  rowsLength?: number;
}) => {
  const sort = initialSort || 'createdAt';
  const order = initialOrder || 'desc';

  return infiniteQueryOptions({
    queryKey: taskKeys.list({ orgIdOrSlug, projectId, status, q, sort, order }),
    initialPageParam: 0,
    retry: 1,
    refetchOnWindowFocus: false,
    queryFn: async ({ pageParam: page, signal }) =>
      await getTasksList(
        {
          page,
          q,
          sort,
          order,
          // Fetch more items than the limit if some items were deleted
          limit: limit + Math.max(page * limit - rowsLength, 0),
          // If some items were added, offset should be undefined, otherwise it should be the length of the rows
          offset: rowsLength - page * limit > 0 ? undefined : rowsLength,
          projectId,
          status,
          orgIdOrSlug,
        },
        signal,
      ),
    getNextPageParam: (_lastPage, allPages) => allPages.length,
  });
};

export default function TasksTable() {
  const { t } = useTranslation();
  const { mode } = useThemeStore();
  const navigate = useNavigate();

  const search = useSearch({ from: WorkspaceTableRoute.id });
  const { searchQuery, selectedTasks, setSelectedTasks, setSearchQuery, setFocusedTaskId } = useWorkspaceStore();
  const {
    data: { workspace, projects },
  } = useWorkspaceQuery();

  const focusedTaskId = search.taskIdPreview;

  const taskMutation = useTaskMutation();

  const [sortColumns, setSortColumns] = useState<SortColumn[]>(getInitialSortColumns(search, 'createdAt'));
  const [selectedStatuses] = useState<number[]>(typeof search.status === 'number' ? [search.status] : search.status?.split('_').map(Number) || []);
  const [selectedProjects] = useState<string[]>(search.projectId?.split('_') || []);
  const [columns, setColumns] = useColumns();
  // Search query options
  const sort = sortColumns[0]?.columnKey as TasksSearch['sort'];
  const order = sortColumns[0]?.direction.toLowerCase() as TasksSearch['order'];

  const isFiltered = !!searchQuery || selectedStatuses.length > 0 || selectedProjects.length > 0;
  // Save filters in search params
  const filters = useMemo(
    () => ({
      q: searchQuery,
      sort,
      order,
      projectId: selectedProjects,
      status: selectedStatuses,
    }),
    [searchQuery, sort, order, selectedStatuses, selectedProjects],
  );

  useSaveInSearchParams(filters, { sort: 'createdAt', order: 'desc' });

  // Query tasks
  const tasksQuery = useInfiniteQuery(
    tasksQueryOptions({
      q: searchQuery,
      sort,
      order,
      projectId: search.projectId ? search.projectId : projects.map((p) => p.id).join('_'),
      status: selectedStatuses.join('_'),
      orgIdOrSlug: workspace.organizationId,
    }),
  );

  const rows = useMemo(() => tasksQuery.data?.pages[0].items || [], [tasksQuery.data]);
  const totalCount = rows.length;

  const handleSelectedRowsChange = (selectedRows: Set<string>) => {
    setSelectedTasks(Array.from(selectedRows));
  };

  // const onResetFilters = () => {
  //   setSearchQuery('');
  //   setSelectedProjects([]);
  //   setSelectedStatuses([]);
  // };

  // Open on key press
  const hotKeyPress = (field: string) => {
    const focusedTask = rows.find((t) => t.id === focusedTaskId);
    if (!focusedTask) return;
    const taskCard = document.getElementById(`sheet-card-${focusedTask.id}`);
    if (!taskCard) return;
    if (taskCard && document.activeElement !== taskCard) taskCard.focus();
    const trigger = taskCard.querySelector(`#${field}`);
    if (!trigger) return dropdowner.remove();
    handleTaskDropDownClick(focusedTask, field, trigger as HTMLElement);
  };

  useHotkeys([
    ['A', () => hotKeyPress(`assignedTo-${focusedTaskId}`)],
    ['I', () => hotKeyPress(`impact-${focusedTaskId}`)],
    ['L', () => hotKeyPress(`labels-${focusedTaskId}`)],
    ['S', () => hotKeyPress(`status-${focusedTaskId}`)],
    ['T', () => hotKeyPress(`type-${focusedTaskId}`)],
  ]);

  useEffect(() => {
    if (!rows.length) return;
    if (search.taskIdPreview) {
      const [task] = rows.filter((t) => t.id === search.taskIdPreview);

      if (sheet.get(`task-preview-${search.taskIdPreview}`)) {
        sheet.update(`task-preview-${search.taskIdPreview}`, {
          content: <TaskCard mode={mode} task={task} state="editing" isSelected={false} isFocused={true} isSheet />,
        });
      } else openTaskPreviewSheet(task, mode, navigate);
      return;
    }
    if (search.userIdPreview) {
      const [{ createdBy }] = rows.filter((t) => t.createdBy?.id === search.userIdPreview);
      if (createdBy) openUserPreviewSheet(createdBy, navigate);
    }
  }, [rows]);

  useEffect(() => {
    if (search.q?.length) setSearchQuery(search.q);
    setFocusedTaskId(null);
  }, []);

  useEffect(() => {
    return combine(
      monitorForElements({
        canMonitor({ source }) {
          return isSubtaskData(source.data);
        },
        async onDrop({ location, source }) {
          const target = location.current.dropTargets[0];
          if (!target) return;
          const sourceData = source.data;
          const targetData = target.data;

          const edge: Edge | null = extractClosestEdge(targetData);
          const isSubtask = isSubtaskData(sourceData) && isSubtaskData(targetData);
          if (!edge || !isSubtask) return;
          const newOrder: number = getRelativeTaskOrder(edge, rows, targetData.order, sourceData.item.id, targetData.item.parentId ?? undefined);
          try {
            await taskMutation.mutateAsync({
              id: sourceData.item.id,
              orgIdOrSlug: workspace.organizationId,
              key: 'order',
              data: newOrder,
              projectId: sourceData.item.projectId,
            });
            await queryClient.invalidateQueries({ refetchType: 'active' });
          } catch (err) {
            toast.error(t('common:error.reorder_resource', { resource: t('app:todo') }));
          }
        },
      }),
    );
  }, [rows]);

  return (
    <>
      <TableHeader>
        <ColumnsView className="max-lg:hidden" columns={columns} setColumns={setColumns} />
        <Export
          className="max-lg:hidden"
          filename={`Tasks from ${projects.map((p) => p.name).join(' and ')}`}
          columns={columns}
          selectedRows={configureForExport(
            rows.filter((t) => selectedTasks.includes(t.id)),
            projects,
          )}
          fetchRows={async (limit) => configureForExport(rows.slice(0, limit), projects)}
        />
      </TableHeader>
      <DataTable<Task>
        {...{
          columns: columns.filter((column) => column.visible),
          rows,
          rowHeight: 42,
          totalCount,
          isLoading: tasksQuery.isLoading,
          isFetching: tasksQuery.isFetching,
          isFiltered,
          selectedRows: new Set<string>(selectedTasks),
          onSelectedRowsChange: handleSelectedRowsChange,
          rowKeyGetter: (row) => row.id,
          enableVirtualization: true,
          sortColumns,
          onSortColumnsChange: setSortColumns,
          NoRowsComponent: <ContentPlaceholder Icon={Bird} title={t('common:no_resource_yet', { resource: t('app:tasks').toLowerCase() })} />,
        }}
      />
    </>
  );
}
