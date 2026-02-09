export const generateMagicLink = (token: string): string => {
  const baseUrl = process.env.FUNCTIONS_EMULATOR === 'true'
    ? 'http://localhost:3000'
    : 'https://dadcircles.com';
  return `${baseUrl}/chat?token=${token}`;
};
