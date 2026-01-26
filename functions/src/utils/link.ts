export const generateMagicLink = (sessionId: string): string => {
  const baseUrl = process.env.FUNCTIONS_EMULATOR === 'true'
    ? 'http://localhost:5173'
    : 'https://dadcircles.com';
  return `${baseUrl}/chat?session=${sessionId}`;
};
