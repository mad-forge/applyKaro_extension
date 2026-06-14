import { z } from "zod"

const trimmedString = z.string().transform((value) => value.trim())

export const optimizedSkillsSchema = z
  .object({
    languages: z.array(trimmedString).default([]),
    frontend: z.array(trimmedString).default([]),
    backend_tools: z.array(trimmedString).default([]),
    libraries: z.array(trimmedString).default([]),
    testing: z.array(trimmedString).default([]),
    data: z.array(trimmedString).default([])
  })
  .strict()

export const optimizedExperienceItemSchema = z
  .object({
    title: trimmedString.optional(),
    company: trimmedString.optional(),
    location: trimmedString.optional(),
    duration: trimmedString.optional(),
    points: z.array(trimmedString).default([])
  })
  .strict()

export const optimizeModelResponseSchema = z
  .object({
    optimized_resume_data: z
      .object({
        summary: trimmedString,
        skills: optimizedSkillsSchema,
        experience: z.array(optimizedExperienceItemSchema).default([])
      })
      .strict()
  })
  .strict()

export type OptimizeModelResponse = z.infer<typeof optimizeModelResponseSchema>
