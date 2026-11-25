import { createFileRoute, redirect } from '@tanstack/react-router'
import { getMe } from '#/server/characters.ts'

/** Home sends you to your first character, or to sign in and claim one. */
export const Route = createFileRoute('/')({
  loader: async () => {
    const [first] = (await getMe())?.characters ?? []
    throw first ? redirect({ to: '/$character', params: { character: first.slug } }) : redirect({ to: '/start' })
  },
})
