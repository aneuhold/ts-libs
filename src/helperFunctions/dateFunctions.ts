/**
 * Determines if the dates are on the same day.
 *
 * @param first the first date
 * @param second the second date
 * @returns true if they are on the same day
 */
function datesAreOnSameDay(first: Date, second: Date): boolean {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

export default datesAreOnSameDay;
