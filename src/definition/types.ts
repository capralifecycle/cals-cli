import { z } from "zod"

const definitionRepoPreviousNameSchema = z.object({
  name: z.string(),
  project: z.string(),
})

const definitionRepoSchema = z.object({
  name: z.string(),
  previousNames: z.array(definitionRepoPreviousNameSchema).optional(),
  archived: z.boolean().optional(),
})

const projectSchema = z.object({
  name: z.string(),
  github: z.array(
    z.object({
      organization: z.string(),
      repos: z.array(definitionRepoSchema).optional(),
    }),
  ),
  tags: z.array(z.string()).optional(),
})

export const definitionSchema = z.object({
  projects: z.array(projectSchema),
})

export type Definition = z.infer<typeof definitionSchema>
export type Project = z.infer<typeof projectSchema>
export type DefinitionRepo = z.infer<typeof definitionRepoSchema>
export type DefinitionRepoPreviousName = z.infer<
  typeof definitionRepoPreviousNameSchema
>

export interface GetReposResponse {
  id: string
  orgName: string
  project: Project
  repo: DefinitionRepo
}
