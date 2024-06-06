import { errorResponses, successResponseWithDataSchema, successResponseWithErrorsSchema } from '../../lib/common-responses';
import { deleteByIdsQuerySchema, organizationParamSchema, workspaceParamSchema } from '../../lib/common-schemas';
import { createRouteConfig } from '../../lib/route-config';
import { isAllowedTo, isAuthenticated, splitByAllowance } from '../../middlewares/guard';

import { apiWorkspacesSchema, createWorkspaceJsonSchema, updateWorkspaceJsonSchema } from './schema';

export const createWorkspaceRouteConfig = createRouteConfig({
  method: 'post',
  path: '/workspaces',
  guard: [isAuthenticated, isAllowedTo('create', 'workspace')],
  tags: ['workspaces'],
  summary: 'Create new workspace',
  description: 'Create personal workspace to organize projects and tasks.',
  request: {
    params: organizationParamSchema,
    body: {
      required: true,
      content: {
        'application/json': {
          schema: createWorkspaceJsonSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'workspace was created',
      content: {
        'application/json': {
          schema: successResponseWithDataSchema(apiWorkspacesSchema),
        },
      },
    },
    ...errorResponses,
  },
});

export const getWorkspaceRouteConfig = createRouteConfig({
  method: 'get',
  path: '/workspaces/{workspace}',
  guard: [isAuthenticated, isAllowedTo('read', 'workspace')],
  tags: ['workspaces'],
  summary: 'Get workspace',
  description: 'Get workspace by id or slug.',
  request: {
    params: workspaceParamSchema,
  },
  responses: {
    200: {
      description: 'Workspace',
      content: {
        'application/json': {
          schema: successResponseWithDataSchema(apiWorkspacesSchema),
        },
      },
    },
    ...errorResponses,
  },
});

export const updateWorkspaceRouteConfig = createRouteConfig({
  method: 'put',
  path: '/workspaces/{workspace}',
  guard: [isAuthenticated, isAllowedTo('update', 'workspace')],
  tags: ['workspaces'],
  summary: 'Update workspace',
  description: 'Update workspace by id or slug.',
  request: {
    params: workspaceParamSchema,
    body: {
      content: {
        'application/json': {
          schema: updateWorkspaceJsonSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Workspace updated',
      content: {
        'application/json': {
          schema: successResponseWithDataSchema(apiWorkspacesSchema),
        },
      },
    },
    ...errorResponses,
  },
});

export const deleteWorkspacesRouteConfig = createRouteConfig({
  method: 'delete',
  path: '/workspaces',
  guard: [isAuthenticated, splitByAllowance('delete', 'workspace')],
  tags: ['workspaces'],
  summary: 'Delete workspaces',
  description: 'Delete workspaces by ids.',
  request: {
    query: deleteByIdsQuerySchema,
  },
  responses: {
    200: {
      description: 'Success',
      content: {
        'application/json': {
          schema: successResponseWithErrorsSchema(),
        },
      },
    },
    ...errorResponses,
  },
});
