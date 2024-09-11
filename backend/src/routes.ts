// import attachmentsRoutes from '#/modules/attachments';
import authRoutes from '#/modules/auth';
import generalRoutes from '#/modules/general';
import meRoutes from '#/modules/me';
import membershipsRoutes from '#/modules/memberships';
import organizationsRoutes from '#/modules/organizations';
import requestsRoutes from '#/modules/requests';
import usersRoutes from '#/modules/users';
import workspacesRoutes from '#/modules/workspaces';
import labelsRoutes from '#/modules/labels';
import projectsRoutes from '#/modules/projects';
import tasksRoutes from '#/modules/tasks';
import baseApp from './server';

const app = baseApp
  .route('/auth', authRoutes)
  .route('/me', meRoutes)
  .route('/users', usersRoutes)
  .route('/organizations', organizationsRoutes)
  .route('/', generalRoutes)
  .route('/requests', requestsRoutes)
  .route('/memberships', membershipsRoutes)
  // .route('/attachments', attachmentsRoutes);

  .route('/workspaces', workspacesRoutes)
  .route('/projects', projectsRoutes)
  .route('/tasks', tasksRoutes)
  .route('/labels', labelsRoutes);

// Description of the app-specific modules for the API docs, generated by hono/zod-openapi and scalar/hono-api-reference
export const appModulesList = [
  {
    name: 'workspaces',
    description:
      'App-specific context entity. Workspace functions for end-users to personalize how they interact with their projects and the content in each project. Only the creator has access and no other members are possible.',
  },
  {
    name: 'projects',
    description:
      'App-specific context entity. Projects - like organizations - can have multiple members and are the primary entity in relation to the content-related resources: tasks, labels and attachments. Because a project can be in multiple workspaces, a relations table is maintained.',
  },
  {
    name: 'tasks',
    description: 'App-specific product entity. Tasks are added to a project and can also contain subtasks.',
  },
  {
    name: 'labels',
    description: 'App-specific product entity. Labels are given to tasks and are listed as part of on or more projects.',
  },
];

export default app;
