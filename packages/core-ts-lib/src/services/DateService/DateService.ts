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
   *
   * @param date - The date to format.
   * @returns The formatted date string.
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
   *
   * @param date - The date to check.
   * @returns True if the date has a time component, false if it is midnight.
   */
  static dateHasTime(date: Date): boolean {
    return !this.dateIsMidnight(date);
  }

  /**
   * Formats the date as a string.
   *
   * @param date - The date to format.
   * @returns The formatted date string.
   */
  static getDateString(date: Date): string {
    return this.dateFormatter.format(date);
  }

  /**
   * Formats the date and time as a string.
   *
   * @param date - The date to format.
   * @returns The formatted date and time string.
   */
  static getDateTimeString(date: Date): string {
    return this.dateTimeFormatter.format(date);
  }

  /**
   * Determines if two dates are equal. This is strict, down to the ms.
   *
   * @param date1 - The first date to compare.
   * @param date2 - The second date to compare.
   * @returns True if the dates are equal, false otherwise.
   */
  static datesAreEqual(date1: Date | undefined | null, date2: Date | undefined | null): boolean {
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
   *
   * @param date - The date to get the last day of the month for.
   * @returns The last day of the month.
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
   *
   * @param date - The date to get the week of the month for.
   * @returns The week of the month.
   */
  static getWeekOfMonth(date: Date): number {
    const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const firstDayOfMonthWeekday = firstDayOfMonth.getDay();
    const firstDayOfSecondWeek = new Date(firstDayOfMonth);
    const daysUntilSecondWeek = 7 - firstDayOfMonthWeekday;
    firstDayOfSecondWeek.setDate(firstDayOfSecondWeek.getDate() + daysUntilSecondWeek);
    if (date < firstDayOfSecondWeek) {
      return 1;
    }
    const daysSinceFirstDayOfSecondWeek = date.getDate() - firstDayOfSecondWeek.getDate();
    const weeksSinceFirstDayOfSecondWeek = Math.floor(daysSinceFirstDayOfSecondWeek / 7);
    return weeksSinceFirstDayOfSecondWeek + 2;
  }

  /**
   * Gets the last week of the month for the provided date.
   *
   * @param date - The date to get the last week of the month for.
   * @returns The last week of the month.
   */
  static getLastWeekOfMonth(date: Date): number {
    const lastDayOfMonth = this.getLastDayOfGivenMonth(date);
    return this.getWeekOfMonth(lastDayOfMonth);
  }

  /**
   * Gets the number of days until the specified weekday.
   *
   * @param date - The date to start from.
   * @param day - The weekday to get the number of days until.
   * @returns The number of days until the specified weekday.
   */
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
   *
   * @param date - The date to start from.
   * @param day - The weekday to get the date for.
   * @param week - The week of the month to get the date for.
   * @returns The date of the specified weekday in the specified week of the month.
   */
  static getWeekDayOfXWeekOfMonth(date: Date, day: number, week: number | 'last'): Date | null {
    if ((typeof week === 'number' && (week < 1 || week > 5)) || day < 0 || day > 6) {
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
    resultDate.setDate(resultDate.getDate() + this.getDaysUntilWeekDay(firstDayOfMonth, day));
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
   *
   * @param date - The date to add days to.
   * @param days - The number of days to add.
   * @returns The new date with the added days.
   */
  static addDays(date: Date, days: number): Date {
    const newDate = new Date(date);
    newDate.setDate(newDate.getDate() + days);
    return newDate;
  }

  /**
   * Adds the provided number of months to the provided date.
   *
   * @param date - The date to add months to.
   * @param months - The number of months to add.
   * @returns The new date with the added months.
   */
  static addMonths(date: Date, months: number): Date {
    const newDate = new Date(date);
    newDate.setMonth(newDate.getMonth() + months);
    return newDate;
  }

  /**
   * Adds the provided number of weeks to the provided date.
   *
   * @param date - The date to add weeks to.
   * @param weeks - The number of weeks to add.
   * @returns The new date with the added weeks.
   */
  static addWeeks(date: Date, weeks: number): Date {
    return this.addDays(date, weeks * 7);
  }

  /**
   * Adds the provided number of years to the provided date.
   *
   * @param date - The date to add years to.
   * @param years - The number of years to add.
   * @returns The new date with the added years.
   */
  static addYears(date: Date, years: number): Date {
    const newDate = new Date(date);
    newDate.setFullYear(newDate.getFullYear() + years);
    return newDate;
  }

  /**
   * For personal projects, midnight can mean exactly midnight, or 11:59pm.
   * It acts as a border between two dates.
   *
   * @param date - The date to check.
   * @returns True if the date is midnight, false otherwise.
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
   * @param first - The first date.
   * @param second - The second date.
   * @returns True if they are on the same day, false otherwise.
   */
  static datesAreOnSameDay(first: Date, second: Date): boolean {
    return (
      first.getFullYear() === second.getFullYear() &&
      first.getMonth() === second.getMonth() &&
      first.getDate() === second.getDate()
    );
  }

  /**
   * Reviver function for JSON.parse to automatically convert ISO date strings
   * back to Date objects.
   *
   * This follows the signature used by JSON.parse for reviver functions.
   *
   * @example
   * ```typescript
   * const parsed = JSON.parse(jsonString, DateService.dateReviver);
   * ```
   *
   * @param _key - The key of the property being parsed. (Not actually used.)
   * @param value - The value of the property being parsed.
   */
  static dateReviver(this: void, _key: string, value: unknown): unknown {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/.test(value)) {
      return new Date(value);
    }
    return value;
  }

  /**
   * Recursively revives dates in the provided body. This happens in-place.
   *
   * @param body the body to revive
   */
  static reviveDatesRecursive(body: unknown) {
    if (body === null || typeof body !== 'object') {
      return;
    }

    const keys = Object.keys(body);
    if (keys.length === 0) {
      return;
    }
    const bodyAsRecord = body as Record<string, unknown>;
    for (const key of Object.keys(bodyAsRecord)) {
      const value = bodyAsRecord[key];
      const revivedValue = this.dateReviver(key, value);
      if (revivedValue !== value) {
        bodyAsRecord[key] = revivedValue;
      } else if (typeof value === 'object') {
        this.reviveDatesRecursive(value);
      }
    }
  }
}
