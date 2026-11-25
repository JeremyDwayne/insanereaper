import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { SIGNED_IN } from '#/auth/client.ts'

/** Where the email link lands: tells the tab that asked for the link, then carries on in this one. */
export const Route = createFileRoute('/signed-in')({ component: SignedIn })

function SignedIn() {
  const navigate = useNavigate()
  useEffect(() => {
    const channel = new BroadcastChannel(SIGNED_IN)
    channel.postMessage('signed-in')
    channel.close()
    navigate({ to: '/start', search: { from: 'email' }, replace: true })
  }, [navigate])
  return null
}
