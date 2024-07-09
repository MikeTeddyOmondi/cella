import { useSearch } from '@tanstack/react-router';
import { useLiveQuery } from 'electric-sql/react';
import { Bird } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { SortColumn } from 'react-data-grid';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { z } from 'zod';
import { getMembers } from '~/api/general';
import { enhanceTasks } from '~/hooks/use-filtered-task-helpers.ts';
import useTaskFilters from '~/hooks/use-filtered-tasks';
import useSaveInSearchParams from '~/hooks/use-save-in-search-params';
import ContentPlaceholder from '~/modules/common/content-placeholder';
import { DataTable } from '~/modules/common/data-table';
import ColumnsView from '~/modules/common/data-table/columns-view';
import { getInitialSortColumns } from '~/modules/common/data-table/init-sort-columns';
import { dropdowner } from '~/modules/common/dropdowner/state';
import { type Label, type Task, useElectric } from '~/modules/common/electric/electrify';
import { sheet } from '~/modules/common/sheeter/state.ts';
import { WorkspaceTableRoute, type tasksSearchSchema } from '~/routes/workspaces';
import { useUserStore } from '~/store/user.ts';
import { useWorkspaceStore } from '~/store/workspace';
import type { Member } from '~/types';
import BoardHeader from '../board/header/board-header';
import type { TaskImpact, TaskType } from '../task/create-task-form';
import { getTaskOrder } from '../task/helpers';
import { TaskCard } from '../task/task-card.tsx';
import { SelectImpact } from '../task/task-selectors/select-impact';
import SetLabels from '../task/task-selectors/select-labels';
import AssignMembers from '../task/task-selectors/select-members';
import SelectStatus, { type TaskStatus } from '../task/task-selectors/select-status';
import { SelectTaskType } from '../task/task-selectors/select-task-type';
import { useColumns } from './columns';
import SelectProject from './project';
import HeaderSelectStatus from './status';
import { useThemeStore } from '~/store/theme';

type TasksSearch = z.infer<typeof tasksSearchSchema>;

export default function TasksTable() {
  const search = useSearch({ from: WorkspaceTableRoute.id });

  const { mode } = useThemeStore();
  const { t } = useTranslation();
  const user = useUserStore((state) => state.user);
  const { searchQuery, selectedTasks, setSelectedTasks, projects, setSearchQuery } = useWorkspaceStore(
    ({ searchQuery, selectedTasks, setSelectedTasks, projects, setSearchQuery }) => ({
      searchQuery,
      selectedTasks,
      setSelectedTasks,
      projects,
      setSearchQuery,
    }),
  );

  const [sortColumns, setSortColumns] = useState<SortColumn[]>(getInitialSortColumns(search, 'created_by'));
  const [selectedStatuses, setSelectedStatuses] = useState<number[]>([]);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [members, setMembers] = useState<Member[]>([]);

  const handleTaskActionClick = (task: Task, field: string, trigger: HTMLElement) => {
    let component = <SelectTaskType currentType={task.type as TaskType} changeTaskType={(newType) => handleChange('type', newType, task.id)} />;

    if (field === 'impact')
      component = <SelectImpact value={task.impact as TaskImpact} changeTaskImpact={(newImpact) => handleChange('impact', newImpact, task.id)} />;
    else if (field === 'labels')
      component = (
        <SetLabels
          labels={labels}
          value={task.virtualLabels}
          organizationId={task.organization_id}
          projectId={task.project_id}
          changeLabels={(newLabels) => handleChange('labels', newLabels, task.id)}
          createLabel={createLabel}
        />
      );
    else if (field === 'assigned_to')
      component = (
        <AssignMembers
          users={members}
          value={task.virtualAssignedTo}
          changeAssignedTo={(newMembers) => handleChange('assigned_to', newMembers, task.id)}
        />
      );
    else if (field === 'status')
      component = (
        <SelectStatus
          taskStatus={task.status as TaskStatus}
          changeTaskStatus={(newStatus) => handleChange('status', newStatus, task.id)}
          inputPlaceholder={t('common:placeholder.set_status')}
        />
      );

    return dropdowner(component, { id: `${field}-${task.id}`, trigger, align: ['status', 'assigned_to'].includes(field) ? 'end' : 'start' });
  };

  // Search query options
  const q = searchQuery;
  const tableSort = sortColumns[0]?.columnKey as TasksSearch['tableSort'];
  const order = sortColumns[0]?.direction.toLowerCase() as TasksSearch['order'];

  const isFiltered = !!q || selectedStatuses.length > 0 || selectedProjects.length > 0;
  // biome-ignore lint/style/noNonNullAssertion: <explanation>
  const electric = useElectric()!;

  // Save filters in search params
  const filters = useMemo(
    () => ({
      q,
      tableSort,
      order,
      project_id: selectedProjects,
      status: selectedStatuses,
    }),
    [q, tableSort, order, selectedStatuses, selectedProjects],
  );
  useSaveInSearchParams(filters, { tableSort: 'created_by', order: 'desc' });

  const createLabel = (newLabel: Label) => {
    if (!electric) return toast.error(t('common:local_db_inoperable'));
    // TODO: Implement the following
    // Save the new label to the database
    electric.db.labels.create({ data: newLabel });
  };

  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  const handleChange = (field: keyof Task, value: any, taskId: string) => {
    if (!electric) return toast.error(t('common:local_db_inoperable'));
    const db = electric.db;
    if (field === 'assigned_to' && Array.isArray(value)) {
      const assignedTo = value.map((user) => user.id);
      db.tasks
        .update({
          data: {
            assigned_to: assignedTo,
          },
          where: {
            id: taskId,
            modified_at: new Date(),
            modified_by: user.id,
          },
        })
        .then((resp) => {
          const [updatedTask] = enhanceTasks([resp as Task], labels, members);
          sheet.update(`task-card-preview-${updatedTask.id}`, {
            content: (
              <TaskCard
                mode={mode}
                task={updatedTask}
                isExpanded={true}
                isSelected={false}
                isFocused={true}
                handleTaskChange={handleChange}
                handleTaskActionClick={handleTaskActionClick}
              />
            ),
          });
        });
      return;
    }

    // TODO: Review this
    if (field === 'labels' && Array.isArray(value)) {
      const labels = value.map((label) => label.id);
      db.tasks
        .update({
          data: {
            labels,
            modified_at: new Date(),
            modified_by: user.id,
          },
          where: {
            id: taskId,
          },
        })
        .then((resp) => {
          const [updatedTask] = enhanceTasks([resp as Task], labels, members);
          sheet.update(`task-card-preview-${updatedTask.id}`, {
            content: (
              <TaskCard
                mode={mode}
                task={updatedTask}
                isExpanded={true}
                isSelected={false}
                isFocused={true}
                handleTaskChange={handleChange}
                handleTaskActionClick={handleTaskActionClick}
              />
            ),
          });
        });

      return;
    }
    if (field === 'status') {
      const newOrder = getTaskOrder(taskId, value, tasks);
      db.tasks
        .update({
          data: {
            status: value,
            ...(newOrder && { sort_order: newOrder }),
            modified_at: new Date(),
            modified_by: user.id,
          },
          where: {
            id: taskId,
          },
        })
        .then((resp) => {
          const [updatedTask] = enhanceTasks([resp as Task], labels, members);
          sheet.update(`task-card-preview-${updatedTask.id}`, {
            content: (
              <TaskCard
                mode={mode}
                task={updatedTask}
                isExpanded={true}
                isSelected={false}
                isFocused={true}
                handleTaskChange={handleChange}
                handleTaskActionClick={handleTaskActionClick}
              />
            ),
          });
        });

      return;
    }

    db.tasks
      .update({
        data: {
          [field]: value,
          modified_at: new Date(),
          modified_by: user.id,
        },
        where: {
          id: taskId,
        },
      })
      .then((resp) => {
        const [updatedTask] = enhanceTasks([resp as Task], labels, members);
        sheet.update(`task-card-preview-${updatedTask.id}`, {
          content: (
            <TaskCard
              mode={mode}
              task={updatedTask}
              isExpanded={true}
              isSelected={false}
              isFocused={true}
              handleTaskChange={handleChange}
              handleTaskActionClick={handleTaskActionClick}
            />
          ),
        });
      });
  };

  const [columns, setColumns] = useColumns(mode, handleChange, handleTaskActionClick);

  // TODO: Refactor this when Electric supports count
  const { results: tasks = [], updatedAt } = useLiveQuery(
    electric.db.tasks.liveMany({
      where: {
        project_id: {
          in: selectedProjects.length > 0 ? selectedProjects : projects.map((project) => project.id),
        },
        ...(selectedStatuses.length > 0 && {
          status: {
            in: selectedStatuses,
          },
        }),
        parent_id: null,
        OR: [
          {
            markdown: {
              contains: q,
            },
          },
        ],
      },
      orderBy: {
        [tableSort || 'created_at']: order || 'desc',
      },
    }),
  ) as {
    results: Task[] | undefined;
    updatedAt: Date | undefined;
  };
  const isLoading = !updatedAt;
  // const onResetFilters = () => {
  //   setSearchQuery('');
  //   setSelectedTasks([]);
  //   setSelectedStatuses([]);
  // };

  const handleSelectedRowsChange = (selectedRows: Set<string>) => {
    setSelectedTasks(Array.from(selectedRows));
  };

  const { showingTasks: rows } = useTaskFilters(tasks, true, true, labels, members, true);

  useEffect(() => {
    if (search.q) setSearchQuery(search.q);
  }, []);

  useEffect(() => {
    const fetchLabelsAndMembers = async () => {
      const fetchedLabels = await electric.db.labels.findMany({
        where: {
          project_id: {
            in: projects.map((p) => p.id),
          },
        },
      });
      setLabels(fetchedLabels as Label[]);
      const fetchedMembers = await Promise.all(projects.map((p) => getMembers({ idOrSlug: p.id, entityType: 'project' }).then(({ items }) => items)));

      setMembers(fetchedMembers.flat() as Member[]);
    };

    fetchLabelsAndMembers();
  }, []);

  return (
    <>
      <BoardHeader mode="table">
        <HeaderSelectStatus selectedStatuses={selectedStatuses} setSelectedStatuses={setSelectedStatuses} />
        <SelectProject projects={projects} selectedProjects={selectedProjects} setSelectedProjects={setSelectedProjects} />
        <ColumnsView className="max-lg:hidden" columns={columns} setColumns={setColumns} />
      </BoardHeader>
      <DataTable<Task>
        {...{
          columns: columns.filter((column) => column.visible),
          rows,
          rowHeight: 42,
          totalCount: tasks.length,
          isLoading,
          isFiltered,
          selectedRows: new Set<string>(selectedTasks),
          onSelectedRowsChange: handleSelectedRowsChange,
          rowKeyGetter: (row) => row.id,
          enableVirtualization: true,
          sortColumns,
          onSortColumnsChange: setSortColumns,
          NoRowsComponent: <ContentPlaceholder Icon={Bird} title={t('common:no_resource_yet', { resource: t('common:tasks').toLowerCase() })} />,
        }}
      />
    </>
  );
}
