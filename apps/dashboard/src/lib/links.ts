/** The public website, which hosts the integration docs at `/docs`. */
const WEBSITE_URL = ((import.meta.env.VITE_WEBSITE_URL as string | undefined) || 'https://arkyc.toneflix.net').replace(
  /\/$/,
  '',
)

export const links = {
  docs: `${WEBSITE_URL}/docs`,
}
