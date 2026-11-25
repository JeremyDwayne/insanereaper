import { env } from 'cloudflare:workers'

/** Link in the sign-in email. It signs in with the same code, so either one works. */
export const signInLink = (email: string, code: string) =>
  `${env.BETTER_AUTH_URL}/signed-in?${new URLSearchParams({ email, code })}`

/** Emails a sign-in code and link through Postmark. Without a token (local dev) it logs them instead. */
export async function sendSignInEmail(to: string, code: string): Promise<void> {
  const url = signInLink(to, code)
  if (!env.POSTMARK_TOKEN) {
    console.log(`Sign-in code for ${to}: ${code} ${url}`)
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
      Subject: `${code} is your Insane Reaper sign-in code`,
      TextBody: `Your sign-in code is ${code}\n\nOr sign in with this link: ${url}\n\nBoth expire in 15 minutes. If you did not ask for them, ignore this email.`,
      HtmlBody: `<p>Your sign-in code is</p><p style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</p><p>Or <a href="${url}">sign in with this link</a>.</p><p>Both expire in 15 minutes. If you did not ask for them, ignore this email.</p>`,
      MessageStream: 'outbound',
    }),
  })
  if (!res.ok) throw new Error(`Postmark ${res.status}: ${await res.text()}`)
}
