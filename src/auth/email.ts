import { env } from 'cloudflare:workers'

/** Sends a sign-in link through Postmark. Without a token (local dev) it logs the link instead. */
export async function sendSignInLink(to: string, url: string): Promise<void> {
  if (!env.POSTMARK_TOKEN) {
    console.log(`Sign-in link for ${to}: ${url}`)
    return
  }
  const res = await fetch('https://api.postmarkapp.com/email', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Postmark-Server-Token': env.POSTMARK_TOKEN,
    },
    body: JSON.stringify({
      From: env.EMAIL_FROM,
      To: to,
      Subject: 'Your Insane Reaper sign-in link',
      TextBody: `Sign in to Insane Reaper: ${url}\n\nThe link expires in 15 minutes. If you did not ask for it, ignore this email.`,
      HtmlBody: `<p><a href="${url}">Sign in to Insane Reaper</a></p><p>The link expires in 15 minutes. If you did not ask for it, ignore this email.</p>`,
      MessageStream: 'outbound',
    }),
  })
  if (!res.ok) throw new Error(`Postmark ${res.status}: ${await res.text()}`)
}
