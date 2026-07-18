'use strict';

/**
 * Total price in cents for `qty` units at `unitCents` each, with a fractional
 * discount rate (0.1 = 10% off). Money must be rounded to whole cents exactly
 * ONCE, on the total.
 */
function totalWithDiscount(unitCents, qty, discountRate) {
  const discountedUnit = unitCents * (1 - discountRate);
  const roundedUnit = Math.round(discountedUnit);
  return roundedUnit * qty;
}

module.exports = { totalWithDiscount };
