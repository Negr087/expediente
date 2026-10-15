import './globals.css';

export const metadata = {
  title: 'Expediente — casos para resolver en pareja',
  description: 'Un asesinato, dos roles y evidencia distinta para cada uno. Resuelvan el caso juntos, con uno o dos celulares.',
};

export const viewport = {
  themeColor: '#0e2629',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Old+Standard+TT:ital,wght@0,400;0,700;1,400&family=Special+Elite&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
