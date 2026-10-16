/** @type {import('next').NextConfig} */
const nextConfig = {
  // ws (para los avisos de Nostr) se rompe si Next lo empaqueta.
  serverExternalPackages: ['ws'],
  // Los casos y sus imágenes se leen del disco: hay que incluirlos en el deploy.
  outputFileTracingIncludes: {
    '/**': ['./casos/**/*'],
    '/api/rooms/[code]/media/[file]': ['./media/**/*'],
  },
};
export default nextConfig;
