import { createFileRoute } from '@tanstack/react-router'
import { catalogue } from '#/catalogue/index.ts'
import { loadCharacter } from '#/characters/load.server.ts'
import { bossImage } from '#/og/image.tsx'
import { bossEmbed } from '#/progress/embed.ts'

/** A boss link's embed image. Its URL carries a version of what is left, so each URL is cached for good. */
export const Route = createFileRoute('/og/$character/$boss')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const cache = await caches.open('og')
        const hit = await cache.match(request)
        if (hit) return hit
        const c = await loadCharacter(params.character)
        const b = c && bossEmbed(catalogue, { items: c.items, tasks: new Set(c.tasks) }, params.boss)
        if (!c || !b) return new Response('Not found', { status: 404 })
        const response = new Response(await bossImage(b, c.name), {
          headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=31536000, immutable' },
        })
        await cache.put(request, response.clone())
        return response
      },
    },
  },
})
