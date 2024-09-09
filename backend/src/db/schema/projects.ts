import { relations } from 'drizzle-orm';
import { pgTable, timestamp, varchar } from 'drizzle-orm/pg-core';
import { usersTable } from '#/db/schema/users';
import { nanoid } from '#/lib/nanoid';
import { membershipsTable } from './memberships';
import { organizationsTable } from './organizations';
import { projectsToWorkspacesTable } from './projects-to-workspaces';

export const projectsTable = pgTable('projects', {
  id: varchar('id').primaryKey().$defaultFn(nanoid),
  entity: varchar('entity', { enum: ['project'] })
    .notNull()
    .default('project'),
  slug: varchar('slug').notNull(),
  name: varchar('name').notNull(),
  thumbnailUrl: varchar('thumbnail_url'),
  bannerUrl: varchar('banner_url'),
  organizationId: varchar('organization_id')
    .notNull()
    .references(() => organizationsTable.id, {
      onDelete: 'cascade',
    }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  createdBy: varchar('created_by').references(() => usersTable.id, {
    onDelete: 'set null',
  }),
  modifiedAt: timestamp('modified_at'),
  modifiedBy: varchar('modified_by').references(() => usersTable.id, {
    onDelete: 'set null',
  }),
});

export const projectsTableRelations = relations(projectsTable, ({ many }) => ({
  users: many(membershipsTable),
  workspaces: many(projectsToWorkspacesTable),
}));

export type ProjectModel = typeof projectsTable.$inferSelect;
export type InsertProjectModel = typeof projectsTable.$inferInsert;
