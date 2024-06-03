import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../../db/db';
import { membershipsTable } from '../../db/schema/memberships';
import { workspacesTable } from '../../db/schema/workspaces';

import { type ErrorType, createError, errorResponse } from '../../lib/errors';
import { sendSSEToUsers } from '../../lib/sse';
import { logEvent } from '../../middlewares/logger/log-event';
import { CustomHono } from '../../types/common';
import { checkSlugAvailable } from '../general/helpers/check-slug';
import { createWorkspaceRouteConfig, deleteWorkspacesRouteConfig, getWorkspaceByIdOrSlugRouteConfig, updateWorkspaceRouteConfig } from './routes';

const app = new CustomHono();

// * Workspace endpoints
const workspacesRoutes = app
  /*
   * Create workspace
   */
  .openapi(createWorkspaceRouteConfig, async (ctx) => {
    const { name, slug } = ctx.req.valid('json');
    const user = ctx.get('user');
    const { organizationId } = ctx.get('workspace');

    const slugAvailable = await checkSlugAvailable(slug);

    if (!slugAvailable) {
      return errorResponse(ctx, 409, 'slug_exists', 'warn', 'WORKSPACE', { slug });
    }

    const [createdWorkspace] = await db
      .insert(workspacesTable)
      .values({
        organizationId,
        name,
        slug,
      })
      .returning();

    logEvent('Workspace created', { workspace: createdWorkspace.id });

    await db.insert(membershipsTable).values({
      userId: user.id,
      organizationId,
      workspaceId: createdWorkspace.id,
      type: 'WORKSPACE',
      role: 'ADMIN',
    });

    logEvent('User added to workspace', {
      user: user.id,
      workspace: createdWorkspace.id,
    });

    sendSSEToUsers([user.id], 'create_main_entity', {
      ...createdWorkspace,
      storageType: 'workspaces',
      haveSubMenu: true,
      type: 'WORKSPACE',
    });

    return ctx.json(
      {
        success: true,
        data: {
          ...createdWorkspace,
          role: 'ADMIN' as const,
        },
      },
      200,
    );
  })

  /*
   * Get workspace by id or slug
   */
  .openapi(getWorkspaceByIdOrSlugRouteConfig, async (ctx) => {
    const user = ctx.get('user');
    const workspace = ctx.get('workspace');

    const [membership] = await db
      .select()
      .from(membershipsTable)
      .where(and(eq(membershipsTable.userId, user.id), eq(membershipsTable.workspaceId, workspace.id)));

    return ctx.json(
      {
        success: true,
        data: {
          ...workspace,
          role: membership?.role || null,
        },
      },
      200,
    );
  })

  /*
   * Update workspace
   */
  .openapi(updateWorkspaceRouteConfig, async (ctx) => {
    const user = ctx.get('user');
    const workspace = ctx.get('workspace');

    const { name, slug } = ctx.req.valid('json');

    if (slug && slug !== workspace.slug) {
      const slugAvailable = await checkSlugAvailable(slug);

      if (!slugAvailable) {
        return errorResponse(ctx, 409, 'slug_exists', 'warn', 'WORKSPACE', { slug });
      }
    }

    const [updatedWorkspace] = await db
      .update(workspacesTable)
      .set({
        name,
        slug,
        organizationId: workspace.organizationId,
        modifiedAt: new Date(),
        modifiedBy: user.id,
      })
      .where(eq(workspacesTable.id, workspace.id))
      .returning();

    const memberships = await db
      .select()
      .from(membershipsTable)
      .where(and(eq(membershipsTable.type, 'WORKSPACE'), eq(membershipsTable.workspaceId, workspace.id)));

    if (memberships.length > 0) {
      const membersId = memberships.map((member) => member.id);
      sendSSEToUsers(membersId, 'update_main_entity', {
        ...updatedWorkspace,
        storageType: 'workspaces',
        haveSubMenu: true,
        type: 'WORKSPACE',
      });
    }

    logEvent('Workspace updated', { workspace: updatedWorkspace.id });

    return ctx.json(
      {
        success: true,
        data: {
          ...updatedWorkspace,
          role: memberships.find((member) => member.id === user.id)?.role || null,
        },
      },
      200,
    );
  })

  /*
   * Delete workspaces
   */
  .openapi(deleteWorkspacesRouteConfig, async (ctx) => {
    const { ids } = ctx.req.valid('query');
    const user = ctx.get('user');

    // * Convert the workspace ids to an array
    const workspaceIds = Array.isArray(ids) ? ids : [ids];

    const errors: ErrorType[] = [];

    // * Get the workspaces and the user role
    const targets = await db
      .select({
        workspace: workspacesTable,
        userRole: membershipsTable.role,
      })
      .from(workspacesTable)
      .leftJoin(membershipsTable, and(eq(membershipsTable.workspaceId, workspacesTable.id), eq(membershipsTable.userId, user.id)))
      .where(inArray(workspacesTable.id, workspaceIds));

    // * Check if the workspaces exist
    for (const id of workspaceIds) {
      if (!targets.some((target) => target.workspace.id === id)) {
        errors.push(
          createError(ctx, 404, 'not_found', 'warn', 'WORKSPACE', {
            workspace: id,
          }),
        );
      }
    }

    // * Filter out workspaces that the user doesn't have permission to delete
    const allowedTargets = targets.filter((target) => {
      const workspaceId = target.workspace.id;

      if (user.role !== 'ADMIN' && target.userRole !== 'ADMIN') {
        errors.push(
          createError(ctx, 403, 'delete_forbidden', 'warn', 'WORKSPACE', {
            workspace: workspaceId,
          }),
        );
        return false;
      }

      return true;
    });

    // * If the user doesn't have permission to delete any of the workspaces, return an error
    if (allowedTargets.length === 0) {
      return ctx.json(
        {
          success: false,
          errors: errors,
        },
        200,
      );
    }

    // * Get members
    const workspaceMembers = await db
      .select({ id: membershipsTable.userId })
      .from(membershipsTable)
      .where(
        and(
          eq(membershipsTable.type, 'WORKSPACE'),
          inArray(
            membershipsTable.organizationId,
            allowedTargets.map((target) => target.workspace.id),
          ),
        ),
      );

    // * Delete the workspaces
    await db.delete(workspacesTable).where(
      inArray(
        workspacesTable.id,
        allowedTargets.map((target) => target.workspace.id),
      ),
    );

    // * Send SSE events for the workspaces that were deleted
    for (const { workspace } of allowedTargets) {
      // * Send the event to the user if they are a member of the workspace
      if (workspaceMembers.length > 0) {
        const membersId = workspaceMembers.map((member) => member.id).filter(Boolean) as string[];
        sendSSEToUsers(membersId, 'remove_main_entity', { ...workspace, storageType: 'workspaces' });
      }

      logEvent('Workspace deleted', { workspace: workspace.id });
    }

    return ctx.json(
      {
        success: true,
        errors: errors,
      },
      200,
    );
  });

export default workspacesRoutes;

export type WorkspacesRoutes = typeof workspacesRoutes;
