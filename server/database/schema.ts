import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const exercises = sqliteTable('exercises', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull().unique(),
    muscles: text('muscles').notNull(),
})

export type Exercise = typeof exercises.$inferSelect
export type NewExercise = typeof exercises.$inferInsert
