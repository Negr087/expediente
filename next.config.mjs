/** @type {import('next').NextConfig} */
const nextConfig = {
  // Las imágenes de los casos se leen del disco en la API: hay que incluirlas en el deploy.
  outputFileTracingIncludes: {
    '/api/rooms/[code]/media/[file]': ['./media/**/*'],
  },
};
export default nextConfig;
