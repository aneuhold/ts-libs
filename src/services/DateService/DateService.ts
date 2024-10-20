/**
 * A class that supports converting dates across various personal projects.
 *
 * All of the things in this class should be able to be used in Node and the
 * browser.
 */
export default class DateService {
  private static dateFormatter = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  private static dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric'
  });

  /**
   * Gets the date in date format if it is set to midnight, otherwise gets the
   * date in date time format.
   */
  static getAutoDateString(date: Date): string {
    if (this.dateHasTime(date)) {
      return this.getDateTimeString(date);
    }
    return this.getDateString(date);
  }

  /**
   * Determines if a date has a user-specified time component to it, meaning
   * that it isn't midnight.
   */
  static dateHasTime(date: Date): boolean {
    return !this.dateIsMidnight(date);
  }

  static getDateString(date: Date): string {
    return this.dateFormatter.format(date);
  }

  static getDateTimeString(date: Date): string {
    return this.dateTimeFormatter.format(date);
  }

  /**
   * Determines if two dates are equal. This is strict, down to the ms.
   */
  static datesAreEqual(
    date1: Date | undefined | null,
    date2: Date | undefined | null
  ): boolean {
    if (!date1 && !date2) {
      return true;
    }
    if (!date1 || !date2) {
      return false;
    }
    return date1.getTime() === date2.getTime();
  }

  /**
   * Gets the last day of the month for the provided date. This will retain the
   * time that was provided in the date.
   */
  static getLastDayOfGivenMonth(date: Date): Date {
    // Setting the day to 0, makes the date move to the last day of the
    // previous month.
    const newDate = new Date(date);
    newDate.setMonth(newDate.getMonth() + 1);
    newDate.setDate(0);
    return newDate;
  }

  /**
   * Gets the week of the month for the provided date. This starts at 1.
   */
  static getWeekOfMonth(date: Date): number {
    const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const firstDayOfMonthWeekday = firstDayOfMonth.getDay();
    const firstDayOfSecondWeek = new Date(firstDayOfMonth);
    const daysUntilSecondWeek = 7 - firstDayOfMonthWeekday;
    firstDayOfSecondWeek.setDate(
      firstDayOfSecondWeek.getDate() + daysUntilSecondWeek
    );
    if (date < firstDayOfSecondWeek) {
      return 1;
    }
    const daysSinceFirstDayOfSecondWeek =
      date.getDate() - firstDayOfSecondWeek.getDate();
    const weeksSinceFirstDayOfSecondWeek = Math.floor(
      daysSinceFirstDayOfSecondWeek / 7
    );
    return weeksSinceFirstDayOfSecondWeek + 2;
  }

  static getLastWeekOfMonth(date: Date): number {
    const lastDayOfMonth = this.getLastDayOfGivenMonth(date);
    return this.getWeekOfMonth(lastDayOfMonth);
  }

  static getDaysUntilWeekDay(date: Date, day: number): number {
    const daysUntilWeekDay = day - date.getDay();
    if (daysUntilWeekDay < 0) {
      return daysUntilWeekDay + 7;
    }
    return daysUntilWeekDay;
  }

  /**
   * Gets the date of the provided weekday in the provided week of the month.
   * Retains the time that was provided in the date.
   *
   * For example, the 2nd Monday of the month, or the last Saturday of the
   * month.
   */
  static getWeekDayOfXWeekOfMonth(
    date: Date,
    day: number,
    week: number | 'last'
  ): Date | null {
    if (
      (typeof week === 'number' && (week < 1 || week > 5)) ||
      day < 0 ||
      day > 6
    ) {
      return null;
    }
    if (week === 'last') {
      let resultDate = this.getLastDayOfGivenMonth(date);
      while (resultDate.getDay() !== day) {
        resultDate = this.addDays(resultDate, -1);
      }
      return resultDate;
    }
    const firstDayOfMonth = new Date(date);
    firstDayOfMonth.setDate(1);
    let resultDate = new Date(firstDayOfMonth);
    resultDate.setDate(
      resultDate.getDate() + this.getDaysUntilWeekDay(firstDayOfMonth, day)
    );
    // The number of times the day has shown up so far.
    let instanceOfDay = 1;
    while (instanceOfDay < week) {
      resultDate = this.addWeeks(resultDate, 1);
      instanceOfDay += 1;
      if (resultDate.getMonth() !== date.getMonth()) {
        return null;
      }
    }
    return resultDate;
  }

  /**
   * Adds the provided number of days to the provided date. If the days are
   * over or under the number of days in the month, then the month will be
   * adjusted accordingly.
   */
  static addDays(date: Date, days: number): Date {
    const newDate = new Date(date);
    newDate.setDate(newDate.getDate() + days);
    return newDate;
  }

  static addMonths(date: Date, months: number): Date {
    const newDate = new Date(date);
    newDate.setMonth(newDate.getMonth() + months);
    return newDate;
  }

  static addWeeks(date: Date, weeks: number): Date {
    return this.addDays(date, weeks * 7);
  }

  static addYears(date: Date, years: number): Date {
    const newDate = new Date(date);
    newDate.setFullYear(newDate.getFullYear() + years);
    return newDate;
  }

  /**
   * For personal projects, midnight can mean exactly midnight, or 11:59pm.
   * It acts as a border between two dates.
   */
  static dateIsMidnight(date: Date): boolean {
    return (
      (date.getHours() === 0 && date.getMinutes() === 0) ||
      (date.getHours() === 23 && date.getMinutes() === 59)
    );
  }

  /**
   * Determines if the dates are on the same day.
   *
   * @param first the first date
   * @param second the second date
   * @returns true if they are on the same day
   */
  datesAreOnSameDay(first: Date, second: Date): boolean {
    return (
      first.getFullYear() === second.getFullYear() &&
      first.getMonth() === second.getMonth() &&
      first.getDate() === second.getDate()
    );
  }
}
