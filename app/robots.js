/** The portal is an internal tool: block every crawler. */
export default function robots() {
  return {
    rules: [{ userAgent: '*', disallow: '/' }],
  };
}
