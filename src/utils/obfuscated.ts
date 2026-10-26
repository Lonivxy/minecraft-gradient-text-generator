const OBFUSCATED_CHARACTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*?";

export const randomObfuscatedCharacter = () => {
  return OBFUSCATED_CHARACTERS[Math.floor(Math.random() * OBFUSCATED_CHARACTERS.length)];
};

export const randomObfuscatedText = (text: string) => {
  return Array.from(text, (character) => character.trim() === "" ? character : randomObfuscatedCharacter()).join("");
};
