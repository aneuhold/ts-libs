import { describe, expect, it } from 'vitest';
import DateService from './DateService.js';

describe('DateService', () => {
  describe('addWeeks', () => {
    it('should successfully add weeks to a date', () => {
      const result = DateService.addWeeks(new Date(2024, 0, 1), 1);
      expect(result).toEqual(new Date(2024, 0, 8));
    });

    it('should successfully add weeks to a date that crosses months', () => {
      const result = DateService.addWeeks(new Date(2024, 0, 23), 2);
      expect(result).toEqual(new Date(2024, 1, 6));
    });

    it('should successfully add weeks to a date that crosses years', () => {
      const result = DateService.addWeeks(new Date(2024, 11, 25), 1);
      expect(result).toEqual(new Date(2025, 0, 1));
    });
  });

  describe('getWeekOfMonth', () => {
    it('should successfully get the week of month for a date', () => {
      const result = DateService.getWeekOfMonth(new Date(2024, 0, 14));
      expect(result).toEqual(3);

      const result2 = DateService.getWeekOfMonth(new Date(2024, 0, 1));
      expect(result2).toEqual(1);

      const result3 = DateService.getWeekOfMonth(new Date(2024, 0, 31));
      expect(result3).toEqual(5);
    });
  });

  describe('getWeekDayOfXWeekOfMonth', () => {
    it('should successfully get the 2nd monday of January 2024', () => {
      const result = DateService.getWeekDayOfXWeekOfMonth(new Date(2024, 0, 1), 1, 2);
      expect(result).toEqual(new Date(2024, 0, 8));
    });

    it('should successfully get the 3rd monday of January 2024', () => {
      const result = DateService.getWeekDayOfXWeekOfMonth(new Date(2024, 0, 1), 1, 3);
      expect(result).toEqual(new Date(2024, 0, 15));
    });

    it('should successfully get the 3rd tuesday of January 2024', () => {
      const result = DateService.getWeekDayOfXWeekOfMonth(new Date(2024, 0, 1), 2, 3);
      expect(result).toEqual(new Date(2024, 0, 16));
    });

    it('should successfully get the 1st Saturday of January 2024', () => {
      const result = DateService.getWeekDayOfXWeekOfMonth(new Date(2024, 0, 1), 6, 1);
      expect(result).toEqual(new Date(2024, 0, 6));
    });

    it('should successfully get the 1st sunday of January 2024', () => {
      const result = DateService.getWeekDayOfXWeekOfMonth(new Date(2024, 0, 1), 0, 1);
      expect(result).toEqual(new Date(2024, 0, 7));
    });

    it('should successfully get the last sunday of January 2024', () => {
      const result = DateService.getWeekDayOfXWeekOfMonth(new Date(2024, 0, 1), 0, 'last');
      expect(result).toEqual(new Date(2024, 0, 28));
    });

    it('should return null if the week and day do not exist', () => {
      const result = DateService.getWeekDayOfXWeekOfMonth(new Date(2024, 0, 1), 0, 5);
      expect(result).toEqual(null);
    });
  });

  describe('dateReviver', () => {
    it('should convert ISO date strings to Date objects', () => {
      const dateStr = '2023-10-27T10:00:00.000Z';
      const mockResponse = {
        createdAt: dateStr,
        name: 'Test'
      };

      const parsed = JSON.parse(JSON.stringify(mockResponse), DateService.dateReviver) as {
        createdAt: Date;
        name: string;
      };

      expect(parsed.createdAt).toBeInstanceOf(Date);
      expect(parsed.createdAt.toISOString()).toBe(dateStr);
      expect(parsed.name).toBe('Test');
    });

    it('should leave non-ISO date strings untouched', () => {
      const mockResponse = {
        someString: '2023-10-27',
        anotherString: 'hello world'
      };

      const parsed = JSON.parse(JSON.stringify(mockResponse), DateService.dateReviver) as {
        someString: string;
        anotherString: string;
      };

      expect(typeof parsed.someString).toBe('string');
      expect(parsed.someString).toBe('2023-10-27');
      expect(parsed.anotherString).toBe('hello world');
    });

    it('should leave non-string values untouched', () => {
      const mockResponse = {
        count: 42,
        active: true,
        items: [1, 2, 3]
      };

      const parsed = JSON.parse(JSON.stringify(mockResponse), DateService.dateReviver) as {
        count: number;
        active: boolean;
        items: number[];
      };

      expect(parsed.count).toBe(42);
      expect(parsed.active).toBe(true);
      expect(parsed.items).toEqual([1, 2, 3]);
    });
  });
});
