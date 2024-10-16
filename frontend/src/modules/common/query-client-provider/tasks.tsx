import { useMutation } from '@tanstack/react-query';
import { t } from 'i18next';
import { toast } from 'sonner';
import { type GetTasksParams, createTask, updateTask } from '~/api/tasks';
import { queryClient } from '~/lib/router';
import type { Subtask, Task } from '~/types/app';
import { nanoid } from '~/utils/nanoid';

export type TasksUpdateMutationQueryFnVariables = Parameters<typeof updateTask>[0] & {
  projectId?: string;
};

export type TasksCreateMutationQueryFnVariables = Parameters<typeof createTask>[0];

type InfiniteQueryFnData = {
  items: Task[];
  total: number;
};

export const taskKeys = {
  all: () => ['tasks'] as const,
  lists: () => [...taskKeys.all(), 'list'] as const,
  list: (filters?: GetTasksParams) => [...taskKeys.lists(), filters] as const,
  create: () => [...taskKeys.all(), 'create'] as const,
  update: () => [...taskKeys.all(), 'update'] as const,
  delete: () => [...taskKeys.all(), 'delete'] as const,
};

export const useTaskCreateMutation = () => {
  return useMutation<Task, Error, TasksCreateMutationQueryFnVariables>({
    mutationKey: taskKeys.create(),
    mutationFn: createTask,
  });
};

export const useTaskUpdateMutation = () => {
  return useMutation<Pick<Task, 'summary' | 'description' | 'expandable'>, Error, TasksUpdateMutationQueryFnVariables>({
    mutationKey: taskKeys.update(),
    mutationFn: updateTask,
  });
};

// Helper function to update a task property
const updateTaskProperty = <T extends Task | Subtask>(task: T, variables: TasksUpdateMutationQueryFnVariables): T => {
  return { ...task, [variables.key]: variables.data };
};

// Helper function to update a subtask within the parent
const updateSubtasks = (subtasks: Subtask[], taskId: string, variables: TasksUpdateMutationQueryFnVariables) => {
  return subtasks.map((subtask) => {
    if (subtask.id === taskId) {
      return updateTaskProperty(subtask, variables); // Update the subtask
    }
    return subtask; // No changes
  });
};

queryClient.setMutationDefaults(taskKeys.create(), {
  mutationFn: createTask,
  onMutate: async (variables) => {
    const { id: taskId, organizationId, projectId, parentId, impact } = variables;

    const newTask: Task = {
      ...variables,
      id: taskId || nanoid(),
      impact: impact || null,
      expandable: false,
      parentId: parentId || null,
      labels: [],
      subtasks: [],
      entity: 'task',
      assignedTo: [],
      createdAt: new Date().toISOString(),
      createdBy: null,
      modifiedAt: new Date().toISOString(),
      modifiedBy: null,
    };

    // Cancel any outgoing refetches
    // (so they don't overwrite our optimistic update)
    await queryClient.cancelQueries({ queryKey: taskKeys.list({ orgIdOrSlug: organizationId, projectId }) });
    // Snapshot the previous value
    const previousTasks = queryClient.getQueryData<InfiniteQueryFnData>(taskKeys.list({ orgIdOrSlug: organizationId, projectId }));

    // Optimistically update to the new value
    if (previousTasks) {
      queryClient.setQueryData<InfiniteQueryFnData>(taskKeys.list({ orgIdOrSlug: organizationId, projectId }), (old) => {
        if (!old) {
          return {
            items: [],
            total: 0,
          };
        }

        const updatedTasks = old.items.map((task) => {
          // Update the parent task
          if (task.id === parentId) {
            const t = { ...task, subtasks: [...task.subtasks, newTask] };
            return t;
          }

          // No changes, return task as-is
          return task;
        });

        // Add the new task to the list
        updatedTasks.push(newTask);

        return {
          ...old,
          items: updatedTasks,
        };
      });
    }

    // Return a context object with the snapshotted value
    return { previousTasks };
  },
  onSuccess: (createdTask, { id: taskId, organizationId, projectId }) => {
    queryClient.setQueryData<InfiniteQueryFnData>(taskKeys.list({ orgIdOrSlug: organizationId, projectId }), (oldData) => {
      if (!oldData) {
        return {
          items: [],
          total: 0,
        };
      }

      const updatedTasks = oldData.items.map((task) => {
        // Update the task itself
        if (task.id === taskId) {
          return createdTask;
        }

        // If the task is the parent, update its subtasks
        if (task.subtasks) {
          const updatedSubtasks = task.subtasks.map((subtask) => (subtask.id === taskId ? createdTask : subtask));
          return { ...task, subtasks: updatedSubtasks }; // Return parent with updated subtasks
        }

        // No changes, return task as-is
        return task;
      });

      return {
        ...oldData,
        items: updatedTasks,
      };
    });
    toast.success(t('common:success.create_resource', { resource: t('app:task') }));
  },
  onError: (_, { organizationId, projectId }, context) => {
    if (context?.previousTasks) {
      queryClient.setQueryData(taskKeys.list({ orgIdOrSlug: organizationId, projectId }), context.previousTasks);
    }
    toast.error(t('common:error.create_resource', { resource: t('app:task') }));
  },
});

queryClient.setMutationDefaults(taskKeys.update(), {
  mutationFn: (variables: TasksUpdateMutationQueryFnVariables) => updateTask(variables),
  onMutate: async (variables) => {
    const { id: taskId, orgIdOrSlug, projectId } = variables;

    // Cancel any outgoing refetches
    // (so they don't overwrite our optimistic update)
    await queryClient.cancelQueries({ queryKey: taskKeys.list({ orgIdOrSlug, projectId }) });
    // Snapshot the previous value
    const previousTasks = queryClient.getQueryData<InfiniteQueryFnData>(taskKeys.list({ orgIdOrSlug, projectId }));

    // Optimistically update to the new value
    if (previousTasks) {
      queryClient.setQueryData<InfiniteQueryFnData>(taskKeys.list({ orgIdOrSlug, projectId }), (old) => {
        if (!old) {
          return {
            items: [],
            total: 0,
          };
        }

        const updatedTasks = old.items.map((task) => {
          // Update the task itself
          if (task.id === taskId) {
            const t = updateTaskProperty(task, variables);
            return t;
          }

          // If the task is the parent, update its subtasks
          if (task.subtasks) {
            const updatedSubtasks = updateSubtasks(task.subtasks, taskId, variables);
            return { ...task, subtasks: updatedSubtasks }; // Return parent with updated subtasks
          }

          // No changes, return task as-is
          return task;
        });

        return {
          ...old,
          items: updatedTasks,
        };
      });
    }

    // Return a context object with the snapshotted value
    return { previousTasks };
  },
  onSuccess: (updatedTask, { id: taskId, orgIdOrSlug, projectId }) => {
    queryClient.setQueryData<InfiniteQueryFnData>(taskKeys.list({ orgIdOrSlug, projectId }), (oldData) => {
      if (!oldData) {
        return {
          items: [],
          total: 0,
        };
      }

      const updatedTasks = oldData.items.map((task) => {
        // Update the task itself
        if (task.id === taskId) {
          return {
            ...task,
            ...updatedTask,
          };
        }

        // If the task is the parent, update its subtasks
        if (task.subtasks) {
          const updatedSubtasks = task.subtasks.map((subtask) =>
            subtask.id === taskId
              ? {
                  ...subtask,
                  ...updatedTask,
                }
              : subtask,
          );
          return { ...task, subtasks: updatedSubtasks }; // Return parent with updated subtasks
        }

        // No changes, return task as-is
        return task;
      });

      return {
        ...oldData,
        items: updatedTasks,
      };
    });
  },
  onError: (_, { orgIdOrSlug, projectId }, context) => {
    if (context?.previousTasks) {
      queryClient.setQueryData(taskKeys.list({ orgIdOrSlug, projectId }), context.previousTasks);
    }
  },
});
