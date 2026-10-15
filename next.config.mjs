/** @type {import('next').NextConfig} */
const nextConfig = {
  // Los casos y sus imágenes se leen del disco: hay que incluirlos en el deploy.
  outputFileTracingIncludes: {
    '/**': ['./casos/**/*'],
    '/api/rooms/[code]/media/[file]': ['./media/**/*'],
  },
};
export default nextConfig;
