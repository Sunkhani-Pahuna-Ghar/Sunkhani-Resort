/**
 * Returns true if two date ranges [aStart, aEnd) and [bStart, bEnd) overlap.
 * Check-out day is treated as free (a guest checking out on the 10th doesn't
 * block a guest checking in on the 10th) -- hence the strict < / > comparisons.
 */
function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

module.exports = { rangesOverlap };
