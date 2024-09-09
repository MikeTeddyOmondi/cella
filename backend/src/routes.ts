import attachmentsRoutes from '#/modules/attachments';
import authRoutes from '#/modules/auth';
import generalRoutes from '#/modules/general';
import meRoutes from '#/modules/me';
import membershipsRoutes from '#/modules/memberships';
import organizationsRoutes from '#/modules/organizations';
import requestsRoutes from '#/modules/requests';
import usersRoutes from '#/modules/users';

export type Route = {
  path: string;
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  routes: any;
};

// Combine all routes from each module. The core modules are on top, followed by app-specific modules.
const routes: Route[] = [
  {
    path: '/auth',
    routes: authRoutes,
  },
  {
    path: '/me',
    routes: meRoutes,
  },
  {
    path: '/users',
    routes: usersRoutes,
  },
  {
    path: '/organizations',
    routes: organizationsRoutes,
  },
  {
    path: '/',
    routes: generalRoutes,
  },
  {
    path: '/requests',
    routes: requestsRoutes,
  },
  {
    path: '/memberships',
    routes: membershipsRoutes,
  },
  {
    path: '/attachments',
    routes: attachmentsRoutes,
  },
  // App-specific modules
];

export default routes;

// Description of the app-specific modules for the API docs, generated by hono/zod-openapi and scalar/hono-api-reference
export const appModulesList = [
];
