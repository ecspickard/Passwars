// Strong password generator for the vault's "Add service" flow. Uses
// crypto.getRandomValues (not Math.random) since this output is meant to be
// used as an actual credential.

const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I/O — easy to misread
const LOWER = "abcdefghijkmnopqrstuvwxyz"; // no l
const DIGITS = "23456789"; // no 0/1
const SYMBOLS = "!@#$%^&*()-_=+";

function randomInt(max: number): number {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return arr[0] % max;
}

export function generateStrongPassword(length = 20): string {
  const pools = [UPPER, LOWER, DIGITS, SYMBOLS];
  const all = pools.join("");
  const safeLength = Math.max(length, pools.length);

  // Guarantee at least one character from each pool, then fill the rest.
  const chars: string[] = pools.map((pool) => pool[randomInt(pool.length)]);
  for (let i = chars.length; i < safeLength; i++) {
    chars.push(all[randomInt(all.length)]);
  }

  // Fisher-Yates shuffle so the guaranteed category characters aren't
  // always in the same first few positions.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}
