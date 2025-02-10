import { OpenAPIHono } from '@hono/zod-openapi';
import { and, count, eq, ilike, inArray, isNotNull, isNull, or } from 'drizzle-orm';

import { db } from '#/db/db';
import { membershipsTable } from '#/db/schema/memberships';

import { config } from 'config';
import { mailer } from '#/lib/mailer';

import { tokensTable } from '#/db/schema/tokens';
import { usersTable } from '#/db/schema/users';
import { entityIdFields } from '#/entity-config';
import { type Env, getContextMemberships, getContextOrganization, getContextUser } from '#/lib/context';
import { resolveEntity } from '#/lib/entity';
import { type ErrorType, createError, errorResponse } from '#/lib/errors';
import { i18n } from '#/lib/i18n';
import { sendSSEToUsers } from '#/lib/sse';
import { logEvent } from '#/middlewares/logger/log-event';
import { getUsersByConditions } from '#/modules/users/helpers/get-user-by';
import { getValidEntity } from '#/permissions/get-valid-entity';
import { memberCountsQuery } from '#/utils/counts';
import { nanoid } from '#/utils/nanoid';
import { getOrderColumn } from '#/utils/order-column';
import { encodeLowerCased } from '#/utils/oslo';
import { prepareStringForILikeFilter } from '#/utils/sql';
import { TimeSpan, createDate } from '#/utils/time-span';
import { MemberInviteEmail, type MemberInviteEmailProps } from '../../../emails/member-invite';
import { slugFromEmail } from '../auth/helpers/oauth';
import { userSelect } from '../users/helpers/select';
import { getAssociatedEntityDetails, insertMembership } from './helpers';
import { membershipSelect } from './helpers/select';
import membershipsRouteConfig from './routes';

const app = new OpenAPIHono<Env>();

const membershipsRoutes = app
  /*
   * Invite members to an entity such as an organization
   */
  .openapi(membershipsRouteConfig.createMemberships, async (ctx) => {
    const { emails, role } = ctx.req.valid('json');
    const { idOrSlug, entityType: passedEntityType } = ctx.req.valid('query');

    // Validate entity existence and check user permission for updates
    const { entity, isAllowed } = await getValidEntity(passedEntityType, 'update', idOrSlug);
    if (!entity || !isAllowed) return errorResponse(ctx, 403, 'forbidden', 'warn', passedEntityType);

    // Extract entity details
    const { entity: entityType, id: entityId } = entity;
    const targetEntityIdField = entityIdFields[entityType];

    const user = getContextUser();
    const organization = getContextOrganization();

    // Normalize emails
    const normalizedEmails = emails.map((email) => email.toLowerCase());

    // Determine main entity details (if applicable)
    const { associatedEntityType, associatedEntityIdField, associatedEntityId } = getAssociatedEntityDetails(entity);

    // Fetch existing users based on the provided emails
    const existingUsers = await getUsersByConditions([inArray(usersTable.email, normalizedEmails)]);
    const userIds = existingUsers.map(({ id }) => id);

    // Fetch all existing memberships by organizationId
    const memberships = await db
      .select()
      .from(membershipsTable)
      .where(and(eq(membershipsTable.organizationId, organization.id), inArray(membershipsTable.userId, userIds)));

    // Map for lookup of existing users by email
    const existingUsersByEmail = new Map(existingUsers.map((eu) => [eu.email, eu]));
    const emailsToInvite: { email: string; userId: string | null }[] = [];

    // Process existing users
    await Promise.all(
      existingUsers.map(async (existingUser) => {
        const { id: userId, email } = existingUser;

        // Filter memberships for current user
        const userMemberships = memberships.filter(({ userId: id }) => id === userId);

        // Check if the user is already a member of the target entity
        const hasTargetMembership = userMemberships.some(({ type }) => type === entityType);
        if (hasTargetMembership) return logEvent(`User already member of ${entityType}`, { user: userId, id: entityId });

        // Check for associated memberships and organization memberships
        const hasAssociatedMembership = userMemberships.some(({ type }) => type === associatedEntityType);
        const hasOrgMembership = userMemberships.some(({ type }) => type === 'organization');

        // Determine if membership should be created instantly
        const instantCreateMembership = (entityType !== 'organization' && hasOrgMembership) || (user.role === 'admin' && userId === user.id);

        // If not instant, add to invite list
        if (!instantCreateMembership) return emailsToInvite.push({ email, userId });

        await insertMembership({ userId: existingUser.id, role, entity, addAssociatedMembership: hasAssociatedMembership });

        // TODO: Add SSE to notify user of instant membership creation
      }),
    );

    // Identify emails without associated users
    for (const email of normalizedEmails) if (!existingUsersByEmail.has(email)) emailsToInvite.push({ email, userId: null });

    // Stop if no recipients
    if (emailsToInvite.length === 0) return errorResponse(ctx, 400, 'no_recipients', 'warn'); // Stop if no recipients

    // Generate invitation tokens
    const tokens = emailsToInvite.map(({ email, userId }) => ({
      id: nanoid(),
      token: encodeLowerCased(nanoid()), // unique hashed token
      type: 'invitation' as const,
      email,
      createdBy: user.id,
      expiresAt: createDate(new TimeSpan(7, 'd')),
      role,
      userId,
      [targetEntityIdField]: entityId,
      ...(associatedEntityIdField && associatedEntityId && { [associatedEntityIdField]: associatedEntityId }), // Include associated entity if applicable
      ...(entityType !== 'organization' && { organizationId: organization.id }), // Add org ID if not an organization
    }));

    // Generate inactive tokens
    const inactiveMemberships = tokens.map(({ id: tokenId, userId }) => {
      if (!userId) return Promise.resolve();
      return insertMembership({ userId, role, entity, tokenId });
    });

    // Batch insert tokens and inactive memberships
    const [insertedTokens] = await Promise.all([db.insert(tokensTable).values(tokens).returning(), inactiveMemberships]);

    // Prepare and send invitation emails
    const recipients = insertedTokens.map((tokenRecord) => ({
      email: tokenRecord.email,
      name: slugFromEmail(tokenRecord.email),
      memberInviteLink: `${config.frontendUrl}/invitation/${tokenRecord.token}?tokenId=${tokenRecord.id}`,
    }));

    const emailProps = {
      senderName: user.name,
      senderThumbnailUrl: user.thumbnailUrl,
      orgName: entity.name,
      subject: i18n.t('backend:email.member_invite.subject', {
        lng: organization.defaultLanguage,
        appName: config.name,
        entity: organization.name,
      }),
      lng: organization.defaultLanguage,
    };

    await mailer.prepareEmails<MemberInviteEmailProps, (typeof recipients)[number]>(MemberInviteEmail, emailProps, recipients, user.email);

    logEvent('Users invited to organization', { organization: organization.id }); // Log invitation event

    return ctx.json({ success: true }, 200);
  })
  /*
   * Delete memberships to remove users from entity
   * When user is allowed to delete entity, they can delete memberships too
   */
  .openapi(membershipsRouteConfig.deleteMemberships, async (ctx) => {
    const { entityType, idOrSlug } = ctx.req.valid('query');
    const { ids } = ctx.req.valid('json');

    const { entity, isAllowed } = await getValidEntity(entityType, 'delete', idOrSlug);
    if (!entity) return errorResponse(ctx, 404, 'not_found', 'warn', entityType);
    if (!isAllowed) return errorResponse(ctx, 403, 'forbidden', 'warn', entityType);

    const entityIdField = entityIdFields[entityType];

    // Convert ids to an array
    const membershipIds = Array.isArray(ids) ? ids : [ids];

    const errors: ErrorType[] = [];

    const filters = [eq(membershipsTable.type, entityType), eq(membershipsTable[entityIdField], entity.id)];

    // Get target memberships
    const targets = await db
      .select()
      .from(membershipsTable)
      .where(and(inArray(membershipsTable.userId, membershipIds), ...filters));

    // Check if membership exist
    for (const id of membershipIds) {
      if (!targets.some((target) => target.userId === id)) {
        errors.push(createError(ctx, 404, 'not_found', 'warn', entityType, { user: id }));
      }
    }

    // If the user doesn't have permission to delete any of the memberships, return an error
    if (targets.length === 0) return ctx.json({ success: false, errors: errors }, 200);

    // Delete the memberships
    await db.delete(membershipsTable).where(
      inArray(
        membershipsTable.id,
        targets.map((target) => target.id),
      ),
    );

    // Send SSE events for the memberships that were deleted
    for (const membership of targets) {
      // Send the event to the user if they are a member of the organization
      const memberIds = targets.map((el) => el.userId);
      sendSSEToUsers(memberIds, 'remove_entity', { id: entity.id, entity: entity.entity });

      logEvent('Member deleted', { membership: membership.id });
    }

    return ctx.json({ success: true, errors }, 200);
  })
  /*
   * Update user membership
   */
  .openapi(membershipsRouteConfig.updateMembership, async (ctx) => {
    const { id: membershipId } = ctx.req.valid('param');
    const { role, archived, muted, order } = ctx.req.valid('json');

    const user = getContextUser();
    const memberships = getContextMemberships();
    const organization = getContextOrganization();

    let orderToUpdate = order;

    // Get the membership in valid organization
    const [membershipToUpdate] = await db
      .select()
      .from(membershipsTable)
      .where(and(eq(membershipsTable.id, membershipId), eq(membershipsTable.organizationId, organization.id)))
      .limit(1);

    if (!membershipToUpdate) return errorResponse(ctx, 404, 'not_found', 'warn', 'user', { membership: membershipId });

    const updatedType = membershipToUpdate.type;
    const updatedEntityIdField = entityIdFields[updatedType];

    // if archived changed, set lowest order in relevant memberships
    if (archived !== undefined && archived !== membershipToUpdate.archived) {
      const relevantMemberships = memberships.filter((membership) => membership.type === updatedType && membership.archived === archived);

      const lastOrderMembership = relevantMemberships.sort((a, b) => b.order - a.order)[0];

      const ceilOrder = lastOrderMembership ? Math.ceil(lastOrderMembership.order) : 0;

      orderToUpdate = ceilOrder + 10;
    }

    const membershipContextId = membershipToUpdate[updatedEntityIdField];
    if (!membershipContextId) return errorResponse(ctx, 404, 'not_found', 'warn', updatedType);

    const membershipContext = await resolveEntity(updatedType, membershipContextId);
    if (!membershipContext) return errorResponse(ctx, 404, 'not_found', 'warn', updatedType);

    // Check if user has permission to someone elses membership
    if (user.id !== membershipToUpdate.userId) {
      const { entity, isAllowed } = await getValidEntity(updatedType, 'update', membershipContextId);
      if (!entity) return errorResponse(ctx, 404, 'not_found', 'warn', updatedType);
      if (!isAllowed) return errorResponse(ctx, 403, 'forbidden', 'warn', updatedType);
    }

    const [updatedMembership] = await db
      .update(membershipsTable)
      .set({
        role,
        ...(orderToUpdate !== undefined && { order: orderToUpdate }),
        ...(muted !== undefined && { muted }),
        ...(archived !== undefined && { archived }),
        modifiedBy: user.id,
        modifiedAt: new Date(),
      })
      .where(and(eq(membershipsTable.id, membershipId)))
      .returning();

    sendSSEToUsers([membershipToUpdate.userId], 'update_entity', {
      ...membershipContext,
      membership: updatedMembership,
    });

    logEvent('Membership updated', { user: updatedMembership.userId, membership: updatedMembership.id });

    return ctx.json({ success: true, data: updatedMembership }, 200);
  })
  /*
   * Get members by entity id/slug and type
   */
  .openapi(membershipsRouteConfig.getMembers, async (ctx) => {
    const { idOrSlug, entityType, q, sort, order, offset, limit, role } = ctx.req.valid('query');

    const entity = await resolveEntity(entityType, idOrSlug);
    if (!entity) return errorResponse(ctx, 404, 'not_found', 'warn', entityType);

    const entityIdField = entityIdFields[entity.entity];

    // Build search filters
    const $or = [];
    if (q) {
      const query = prepareStringForILikeFilter(q);
      $or.push(ilike(usersTable.name, query), ilike(usersTable.email, query));
    }

    const usersQuery = db
      .select({ user: userSelect })
      .from(usersTable)
      .where(or(...$or))
      .as('users');
    const membersFilters = [
      eq(membershipsTable[entityIdField], entity.id),
      eq(membershipsTable.type, entityType),
      isNull(membershipsTable.tokenId),
      isNotNull(membershipsTable.activatedAt),
    ];

    if (role) membersFilters.push(eq(membershipsTable.role, role));

    const memberships = db
      .select()
      .from(membershipsTable)
      .where(and(...membersFilters))
      .as('memberships');

    const membershipCount = memberCountsQuery(null, 'userId');

    const orderColumn = getOrderColumn(
      {
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        createdAt: usersTable.createdAt,
        lastSeenAt: usersTable.lastSeenAt,
        role: memberships.role,
      },
      sort,
      usersTable.id,
      order,
    );

    const membersQuery = db
      .select({
        user: userSelect,
        membership: membershipSelect,
        counts: {
          memberships: membershipCount.members,
        },
      })
      .from(usersQuery)
      .innerJoin(memberships, eq(usersTable.id, memberships.userId))
      .leftJoin(membershipCount, eq(usersTable.id, membershipCount.id))
      .orderBy(orderColumn);

    const [{ total }] = await db.select({ total: count() }).from(membersQuery.as('memberships'));

    const result = await membersQuery.limit(Number(limit)).offset(Number(offset));

    const members = await Promise.all(
      result.map(async ({ user, membership, counts }) => ({
        ...user,
        membership,
        counts,
      })),
    );

    return ctx.json({ success: true, data: { items: members, total } }, 200);
  });

export default membershipsRoutes;
