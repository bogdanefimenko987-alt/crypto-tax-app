export function encrypt(text: string): string {
  return Buffer.from(text, 'utf-8').toString('base64');
}

export function decrypt(encryptedText: string): string {
  return Buffer.from(encryptedText, 'base64').toString('utf-8');
}