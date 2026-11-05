/** Cost from level n to n+1; integer arithmetic avoids floating-point ceil drift. */
export function transitionCost(level: number): number {
  if (!Number.isSafeInteger(level) || level < 1)
    throw new RangeError('Level must be a positive integer')
  let cost = 400
  for (let n = 1; n < level; n++) {
    if (!Number.isSafeInteger(cost * 115)) throw new RangeError('Level exceeds supported precision')
    cost = Math.ceil((cost * 115) / 100)
  }
  return cost
}
