import { Link } from '@tanstack/react-router';

import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useBreakpoints } from '~/hooks/use-breakpoints';
import { dateShort } from '~/lib/utils';
import type { Electric, Label, Task } from '~/modules/common/electric/electrify';
import CheckboxColumn from '~/modules/common/data-table/checkbox-column';
import type { ColumnOrColumnGroup } from '~/modules/common/data-table/columns-view';
import HeaderCell from '~/modules/common/data-table/header-cell';
import type { TaskStatus } from '../task/task-selectors/select-status';
import type { Project, User } from '~/types';
import { AvatarWrap } from '~/modules/common/avatar-wrap';
import { useQuery } from '@tanstack/react-query';
import { getProject } from '~/api/projects';
import { taskStatuses } from './status';
import { taskTypes } from '../task/task-selectors/select-task-type.tsx';
import { impacts } from '../task/task-selectors/select-impact.tsx';
import { sheet } from '~/modules/common/sheeter/state.ts';
import { TaskCard } from '../task/task-card.tsx';
import { getUser } from '~/api/users';
import { getMembers } from '~/api/general';
import type { Member } from '~/types';

const statusTextColors = {
  0: 'text-sky-500',
  1: 'text-slate-300',
  2: 'text-slate-500',
  3: 'text-lime-500',
  4: 'text-yellow-500',
  5: 'text-orange-500',
  6: 'text-green-500',
};

const openTaskCardSheet = async (
  row: Task,
  electric: Electric,
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  handleTaskChange: (field: keyof Task, value: any, taskId: string) => void,
  handleTaskActionClick: (task: Task, field: string, trigger: HTMLElement, labels: Label[], members: Member[]) => void,
) => {
  const members = await getMembers({ idOrSlug: row.project_id, entityType: 'PROJECT' }).then((data) => data.items);
  const labels = (await electric.db.labels.findMany({ where: { project_id: row.project_id } })) as Label[];
  sheet(
    <TaskCard
      key={row.id}
      task={{
        ...row,
        virtualAssignedTo: row.assigned_to?.length ? members.filter((m) => row.assigned_to?.includes(m.id)) : [],
        virtualLabels: row.labels?.length ? labels.filter((l) => row.labels?.includes(l.id)) : [],
      }}
      isExpanded={true}
      isSelected={false}
      isFocused={true}
      handleTaskChange={handleTaskChange}
      handleTaskActionClick={(task: Task, field: string, trigger: HTMLElement) => handleTaskActionClick(task, field, trigger, labels, members)}
    />,
    {
      className: 'max-w-full lg:max-w-4xl p-0',
      title: <span className="pl-4">Task card preview</span>,
      text: <span className="pl-4">Here you can modify or delete your task</span>,
      id: 'task-card-preview',
    },
  );
};

export const useColumns = (
  electric: Electric,
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  handleTaskChange: (field: keyof Task, value: any, taskId: string) => void,
  handleTaskActionClick: (task: Task, field: string, trigger: HTMLElement, labels: Label[], members: Member[]) => void,
) => {
  const { t } = useTranslation();
  const isMobile = useBreakpoints('max', 'sm');

  const mobileColumns: ColumnOrColumnGroup<Task>[] = [
    CheckboxColumn,
    {
      key: 'summary',
      name: t('common:summary'),
      visible: true,
      minWidth: 180,
      sortable: true,
      renderHeaderCell: HeaderCell,
      renderCell: ({ row, tabIndex }) => (
        <Link
          tabIndex={tabIndex}
          to="/user/$idOrSlug"
          params={{ idOrSlug: row.slug }}
          className="inline-flex flex-wrap w-auto outline-0 ring-0 group"
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey) return;
            e.preventDefault();
            openTaskCardSheet(row, electric, handleTaskChange, handleTaskActionClick);
          }}
        >
          <span className="font-light whitespace-pre-wrap leading-5 py-1">{row.summary || '-'}</span>
        </Link>
      ),
    },
  ];

  return useState<ColumnOrColumnGroup<Task>[]>(
    isMobile
      ? mobileColumns
      : [
          ...mobileColumns,
          {
            key: 'impact',
            name: t('common:impact'),
            sortable: true,
            visible: true,
            renderHeaderCell: HeaderCell,
            renderCell: ({ row }) => {
              const impact = row.impact !== null ? impacts[row.impact] : null;
              return impact !== null ? impact.label : '-';
            },
            minWidth: 60,
          },
          {
            key: 'type',
            name: t('common:type'),
            sortable: true,
            visible: true,
            cellClass: 'start',
            renderHeaderCell: HeaderCell,
            renderCell: ({ row }) => (
              <>
                {taskTypes[taskTypes.findIndex((t) => t.value === row.type)]?.icon()}{' '}
                <span className="ml-2 font-light">{t(`common:${row.type}`)}</span>
              </>
            ),
            minWidth: 100,
          },
          {
            key: 'status',
            name: t('common:status'),
            sortable: true,
            visible: true,
            renderHeaderCell: HeaderCell,
            renderCell: ({ row }) => (
              <span className={statusTextColors[row.status as TaskStatus]}>{t(taskStatuses[row.status as TaskStatus].status)}</span>
            ),
            minWidth: 100,
          },
          {
            key: 'subTasks',
            name: t('common:todos'),
            sortable: false,
            visible: true,
            renderHeaderCell: HeaderCell,
            renderCell: ({ row }) =>
              row.subTasks.length > 0 ? (
                <div className="inline-flex py-0 h-5 ml-1 gap-[.07rem]">
                  <span className="text-success">{row.subTasks.filter((t) => t.status === 6).length}</span>
                  <span className="font-light">/</span>
                  <span className="font-light">{row.subTasks.length}</span>
                </div>
              ) : (
                row.subTasks.length
              ),
            width: 80,
          },
          {
            key: 'created_by',
            name: t('common:created_by'),
            sortable: true,
            visible: true,
            renderHeaderCell: HeaderCell,
            renderCell: ({ row, tabIndex }) => {
              const { data: user, isFetching } = useQuery<User>({
                queryKey: ['users', row.created_by],
                queryFn: () => getUser(row.created_by),
                staleTime: Number.POSITIVE_INFINITY,
              });
              if (isFetching) return <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />;
              if (!user) return row.created_by;
              return (
                <Link
                  to="/user/$idOrSlug"
                  tabIndex={tabIndex}
                  params={{ idOrSlug: user.id }}
                  className="flex space-x-2 items-center outline-0 ring-0 group"
                >
                  <AvatarWrap type="USER" className="h-8 w-8" id={user.id} name={user.name} url={user.thumbnailUrl} />
                  <span className="group-hover:underline underline-offset-4 truncate font-medium">{user.name || '-'}</span>
                </Link>
              );
            },
            minWidth: 180,
          },
          {
            key: 'project_id',
            name: t('common:project'),
            sortable: true,
            visible: true,
            renderHeaderCell: HeaderCell,
            renderCell: ({ row, tabIndex }) => {
              const { data: project, isFetching } = useQuery<Project>({
                queryKey: ['projects', row.project_id],
                queryFn: () => getProject(row.project_id),
                staleTime: Number.POSITIVE_INFINITY,
              });
              if (isFetching) return <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />;
              if (!project) return row.project_id;

              return (
                <Link
                  to="/workspaces/$idOrSlug"
                  tabIndex={tabIndex}
                  params={{ idOrSlug: project.workspaceId || project.id }}
                  className="flex space-x-2 items-center outline-0 ring-0 group"
                >
                  <AvatarWrap type="PROJECT" className="h-8 w-8" id={project.id} name={project.name} />
                  <span className="group-hover:underline underline-offset-4 truncate font-medium">{project.name || '-'}</span>
                </Link>
              );
            },
          },
          {
            key: 'created_at',
            name: t('common:created_at'),
            sortable: true,
            visible: true,
            renderHeaderCell: HeaderCell,
            renderCell: ({ row }) => dateShort(row.created_at),
            minWidth: 140,
          },
          {
            key: 'modified_at',
            name: t('common:updated_at'),
            sortable: true,
            visible: true,
            renderHeaderCell: HeaderCell,
            renderCell: ({ row }) => dateShort(row.modified_at),
            minWidth: 140,
          },
        ],
  );
};
