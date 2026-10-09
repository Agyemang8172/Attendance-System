import { randomInt } from "crypto";

/**
 * D8 — credential generation.
 *
 * Both helpers use `crypto.randomInt`, not `Math.random`. `Math.random` is a
 * non-cryptographic PRNG seeded from a small state; anything derived from it is
 * guessable from a handful of observed outputs, which is exactly the wrong
 * property for a credential handed out to a new account.
 */

const ADJECTIVES = ["amber","brave","calm","clever","swift","bright","bold","lucky","quiet","sunny","royal","noble","keen","warm","cool","eager","gentle","jolly","merry","witty","zesty","prime","vivid","crisp","snug","plucky","dapper","breezy","mellow","rapid"];
const NOUNS = ["tiger","river","falcon","maple","cedar","otter","comet","harbor","meadow","willow","ember","pebble","lantern","summit","breeze","canyon","beacon","garnet","quartz","sparrow","badger","marlin","cobra","walrus","pelican","heron","jaguar","panther","dolphin","raven"];

const pick = (items: string[]): string => items[randomInt(items.length)];
const fourDigits = (): string => String(randomInt(1000, 10000));

/**
 * A temporary credential an administrator reads out to a new or reset account.
 *
 * 30 × 30 × 10^4 × 10^4 ≈ 7.3 × 10^10, roughly 36 bits. That is not enough for
 * a permanent password, and it is not meant to be: `mustChangePassword` forces
 * the holder to replace it on first use, the login limiter throttles guessing,
 * and the format stays readable because a person has to relay it over the phone.
 */
export const generateTempPassword = (): string =>
  `${pick(ADJECTIVES)}-${pick(NOUNS)}-${fourDigits()}-${fourDigits()}`;

/**
 * Sequential employee codes. The read-then-write here races if two
 * administrators create accounts at the same instant, so the unique constraint
 * on `employeeCode` is what actually stops duplicates — a collision surfaces as
 * P2002 and the caller retries.
 */
export const generateEmployeeCode = async (
  findLast: () => Promise<{ employeeCode: string | null } | null>
): Promise<string> => {
  const last = await findLast();

  let next = 1;
  if (last?.employeeCode) {
    const n = parseInt(last.employeeCode.split("-")[1], 10);
    if (!Number.isNaN(n)) next = n + 1;
  }
  return `EMP-${String(next).padStart(4, "0")}`;
};
