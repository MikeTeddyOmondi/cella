import { zodResolver } from '@hookform/resolvers/zod';
import type { UseFormProps } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { z } from 'zod';

import { Plus } from 'lucide-react';
import { useMemo } from 'react';
import { toast } from 'sonner';
import { createTask } from '~/api/tasks.ts';
import { useFormWithDraft } from '~/hooks/use-draft-form';
import { useHotkeys } from '~/hooks/use-hot-keys';
import { queryClient } from '~/lib/router';
import { BlockNote } from '~/modules/common/blocknote';
import { extractUniqueWordsFromHTML, getNewTaskOrder, handleEditorFocus } from '~/modules/tasks/helpers';
import UppyFilePanel from '~/modules/tasks/task-dropdowns/uppy-file-panel';
import { Button } from '~/modules/ui/button';
import { Form, FormControl, FormField, FormItem, FormMessage } from '~/modules/ui/form';
import { useUserStore } from '~/store/user.ts';
import type { Task } from '~/types/app';
import { createTaskSchema } from '#/modules/tasks/schema';
import { nanoid } from '#/utils/nanoid';
import { useWorkspaceQuery } from '../workspaces/helpers/use-workspace';

const formSchema = createTaskSchema;

type FormValues = z.infer<typeof formSchema>;

export const CreateSubtaskForm = ({
  parentTask,
  formOpen,
  setFormState,
}: {
  parentTask: Task;
  formOpen: boolean;
  setFormState: (value: boolean) => void;
}) => {
  const { t } = useTranslation();
  const {
    data: { members },
  } = useWorkspaceQuery();

  const { user } = useUserStore();
  const defaultId = nanoid();

  const formOptions: UseFormProps<FormValues> = useMemo(
    () => ({
      resolver: zodResolver(formSchema),
      defaultValues: {
        id: defaultId,
        description: '',
        summary: '',
        type: 'chore',
        impact: null,
        status: 1,
        parentId: parentTask.id,
        expandable: false,
        keywords: '',
        projectId: parentTask.projectId,
        order: getNewTaskOrder(1, parentTask.subtasks),
      },
    }),
    [],
  );

  // Form with draft in local storage
  const form = useFormWithDraft<FormValues>(`create-subtask-${parentTask.id}`, formOptions);

  const onSubmit = (values: FormValues) => {
    const newSubtask = {
      id: defaultId,
      description: values.description,
      summary: values.summary,
      expandable: values.expandable,
      keywords: extractUniqueWordsFromHTML(values.description),
      type: 'chore' as const,
      impact: null,
      status: 1,
      parentId: parentTask.id,
      organizationId: parentTask.organizationId,
      assignedTo: [],
      labels: [],
      projectId: parentTask.projectId,
      createdBy: user.id,
      order: getNewTaskOrder(values.status, parentTask.subtasks),
    };

    createTask(newSubtask)
      .then(async (resp) => {
        if (!resp) toast.error(t('common:error.create_resource', { resource: t('app:todo') }));
        form.reset();
        toast.success(t('common:success.create_resource', { resource: t('app:todo') }));
        await queryClient.invalidateQueries({ refetchType: 'active' });
        setFormState(false);
      })
      .catch(() => toast.error(t('common:error.create_resource', { resource: t('app:todo') })));
  };

  // default value in blocknote <p class="bn-inline-content"></p> so check if there it's only one
  const isDirty = () => {
    const { dirtyFields } = form.formState;
    const fieldsKeys = Object.keys(dirtyFields);
    if (fieldsKeys.length === 0) return false;
    if (fieldsKeys.includes('description') && fieldsKeys.length === 1) {
      const description = form.getValues('description');
      const parser = new DOMParser();
      const doc = parser.parseFromString(description, 'text/html');
      const emptyPElements = Array.from(doc.querySelectorAll('p.bn-inline-content'));

      // Check if any <p> element has non-empty text content
      return emptyPElements.some((el) => el.textContent && el.textContent.trim() !== '');
    }
    return true;
  };

  useHotkeys([['Escape', () => setFormState(false)]]);

  if (form.loading) return null;

  if (!formOpen)
    return (
      <Button variant="ghost" size="sm" className="w-full mb-1 pl-11 justify-start rounded-none" onClick={() => setFormState(true)}>
        <Plus size={16} />
        <span className="ml-1 font-normal">{t('app:todo')}</span>
      </Button>
    );
  return (
    <Form {...form}>
      <form id="create-subtask" onSubmit={form.handleSubmit(onSubmit)} className="p-3 mb-2 flex gap-2 flex-col bg-secondary/50">
        <FormField
          control={form.control}
          name="description"
          render={({ field: { value, onChange } }) => {
            return (
              <FormItem>
                <FormControl>
                  <BlockNote
                    id={`blocknote-subtask-${defaultId}`}
                    members={members}
                    defaultValue={value}
                    className="pl-8"
                    onFocus={() => handleEditorFocus(parentTask.id, parentTask.id)}
                    updateData={onChange}
                    onChange={onChange}
                    filePanel={UppyFilePanel(defaultId)}
                    trailingBlock={false}
                    onEnterClick={form.handleSubmit(onSubmit)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            );
          }}
        />
        <div className="flex ml-8 justify-between">
          <div className="flex gap-2">
            <Button size={'xs'} type="submit" disabled={!isDirty()}>
              <span>{t('common:create')}</span>
            </Button>
            <Button
              size={'xs'}
              type="reset"
              variant="secondary"
              className={isDirty() ? '' : 'hidden'}
              aria-label="Cancel"
              onClick={() => form.reset()}
            >
              {t('common:cancel')}
            </Button>
            <Button
              size={'xs'}
              type="button"
              variant="secondary"
              aria-label="close"
              onClick={() => setFormState(false)}
              className={isDirty() ? 'hidden' : ''}
            >
              {t('common:close')}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
};

export default CreateSubtaskForm;
