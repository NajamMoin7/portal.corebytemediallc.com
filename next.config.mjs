/** @type {import('next').NextConfig} */
const nextConfig = {
  // Internal tool — nothing here should be discoverable by search engines.
  // The robots route (app/robots.js) and the metadata in app/layout.js also
  // opt out, but the header is the belt to their braces.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
