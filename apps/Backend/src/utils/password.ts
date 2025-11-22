import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;

//Hash a plain text password using bcrypt
export function hashPassword(password: string): string {
  const hashedPassword = bcrypt.hashSync(password, SALT_ROUNDS);
  console.log(`[PASSWORD] Hashed password with ${SALT_ROUNDS} salt rounds`);
  return hashedPassword;
}

// Compare a plain text password with a hashed password (synchronous)
export function comparePassword(
  plainPassword: string,
  hashedPassword: string,
): boolean {
  const isMatch = bcrypt.compareSync(plainPassword, hashedPassword);
  console.log(`[PASSWORD] Password comparison result: ${isMatch}`);
  return isMatch;
}
