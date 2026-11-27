import { createFileRoute } from '@tanstack/react-router'
import { catalogue } from '#/catalogue/index.ts'
import { loadCharacter } from '#/characters/load.server.ts'
import { bossImage } from '#/og/image.tsx'
import { bossEmbed, imagePath } from '#/progress/embed.ts'

/** A boss link's embed image. Its URL carries a version of what is left, so each URL is cached for good; an old or wrong version redirects to the current one. */
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
        // Only the current version renders, so made-up versions can't force renders or fill the cache.
        const path = imagePath(c.slug, b)
        const url = new URL(request.url)
        if (url.pathname + url.search !== path) return Response.redirect(new URL(path, url), 302)
        const response = new Response(await bossImage(b, c.name), {
          headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=31536000, immutable' },
        })
        await cache.put(request, response.clone())
        return response
      },
    },
  },
})
