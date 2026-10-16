/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    '@docready/contracts',
    '@docready/domain',
    '@docready/db',
    '@docready/ocr',
    '@docready/ai',
    '@docready/files',
    '@docready/exports',
  ],
  reactStrictMode: true,
};

export default nextConfig;
