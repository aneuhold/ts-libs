import { ObjectId } from 'bson';
import DashboardTask from '../../documents/dashboard/Task';
import {
  RecurrenceBasis,
  RecurrenceEffect,
  RecurrenceFrequency,
  RecurrenceFrequencyType
} from '../../embedded-types/dashboard/task/RecurrenceInfo';
import DashboardTaskService from './TaskService';

describe('DashboardTaskService', () => {
  describe('getNextFrequencyDate', () => {
    it('should return a valid date for lastDayOfMonth', () => {
      const basisDate = new Date(2024, 0, 1);
      const frequency: RecurrenceFrequency = {
        type: RecurrenceFrequencyType.lastDayOfMonth
      };
      const result = DashboardTaskService.getNextFrequencyDate(
        basisDate,
        frequency
      );
      expect(result).toEqual(new Date(2024, 0, 31));
    });

    describe('every X time unit', () => {
      it('should return a valid date for every X Day', () => {
        const basisDate = new Date(2024, 0, 1);
        const frequency: RecurrenceFrequency = {
          type: RecurrenceFrequencyType.everyXTimeUnit,
          everyXTimeUnit: {
            timeUnit: 'day',
            x: 2
          }
        };
        const result = DashboardTaskService.getNextFrequencyDate(
          basisDate,
          frequency
        );
        expect(result).toEqual(new Date(2024, 0, 3));
      });

      it('should return a valid date for every X Week', () => {
        const basisDate = new Date(2024, 0, 1);
        const frequency: RecurrenceFrequency = {
          type: RecurrenceFrequencyType.everyXTimeUnit,
          everyXTimeUnit: {
            timeUnit: 'week',
            x: 2
          }
        };
        const result = DashboardTaskService.getNextFrequencyDate(
          basisDate,
          frequency
        );
        expect(result).toEqual(new Date(2024, 0, 15));
      });

      it('should return a valid date for every X Month', () => {
        const basisDate = new Date(2024, 0, 1);
        const frequency: RecurrenceFrequency = {
          type: RecurrenceFrequencyType.everyXTimeUnit,
          everyXTimeUnit: {
            timeUnit: 'month',
            x: 2
          }
        };
        const result = DashboardTaskService.getNextFrequencyDate(
          basisDate,
          frequency
        );
        expect(result).toEqual(new Date(2024, 2, 1));
      });
    });

    it('should return a valid date for weekDaySet', () => {
      const basisDate = new Date(2024, 0, 1);
      const frequency: RecurrenceFrequency = {
        type: RecurrenceFrequencyType.weekDaySet,
        weekDaySet: [0, 6]
      };
      const result = DashboardTaskService.getNextFrequencyDate(
        basisDate,
        frequency
      );
      expect(result).toEqual(new Date(2024, 0, 6));
    });

    describe('Every X Weekday of Month', () => {
      it('should return a valid date for every 2nd Sunday of Month', () => {
        const basisDate = new Date(2024, 0, 1);
        // Every second sunday
        const frequency: RecurrenceFrequency = {
          type: RecurrenceFrequencyType.everyXWeekdayOfMonth,
          everyXWeekdayOfMonth: {
            weekDay: 0,
            weekOfMonth: 2
          }
        };
        const result = DashboardTaskService.getNextFrequencyDate(
          basisDate,
          frequency
        );
        expect(result).toEqual(new Date(2024, 0, 14));
      });

      it('should return a valid date across year change', () => {
        const basisDate = new Date(2023, 11, 30);
        // Every 1st Saturday
        const frequency: RecurrenceFrequency = {
          type: RecurrenceFrequencyType.everyXWeekdayOfMonth,
          everyXWeekdayOfMonth: {
            weekDay: 6,
            weekOfMonth: 1
          }
        };
        const result = DashboardTaskService.getNextFrequencyDate(
          basisDate,
          frequency
        );
        expect(result).toEqual(new Date(2024, 0, 6));
      });

      it('should return a valid next date when the basis is the same as the recurrence', () => {
        const basisDate = new Date(2024, 0, 14);
        // Every second sunday
        const frequency: RecurrenceFrequency = {
          type: RecurrenceFrequencyType.everyXWeekdayOfMonth,
          everyXWeekdayOfMonth: {
            weekDay: 0,
            weekOfMonth: 2
          }
        };
        const result = DashboardTaskService.getNextFrequencyDate(
          basisDate,
          frequency
        );
        expect(result).toEqual(new Date(2024, 1, 11));
      });
    });
  });

  describe('updateDatesForRecurrence', () => {
    describe('Start date basis', () => {
      it('should update the start date correctly for a daily recurrence', () => {
        const task = new DashboardTask(new ObjectId());
        task.startDate = new Date(2024, 0, 1);
        task.recurrenceInfo = {
          frequency: {
            type: RecurrenceFrequencyType.everyXTimeUnit,
            everyXTimeUnit: {
              timeUnit: 'day',
              x: 1
            }
          },
          recurrenceBasis: RecurrenceBasis.startDate,
          recurrenceEffect: RecurrenceEffect.rollOnBasis
        };
        DashboardTaskService.updateDatesForRecurrence(task);
        expect(task.startDate).toEqual(new Date(2024, 0, 2));
      });

      it('should update the start date correctly for daily recurrence on subtask', () => {
        const task = new DashboardTask(new ObjectId());
        task.startDate = new Date(2024, 0, 8);
        task.dueDate = new Date(2024, 0, 13);
        task.recurrenceInfo = {
          frequency: {
            type: RecurrenceFrequencyType.everyXTimeUnit,
            everyXTimeUnit: {
              timeUnit: 'day',
              x: 1
            }
          },
          recurrenceBasis: RecurrenceBasis.startDate,
          recurrenceEffect: RecurrenceEffect.rollOnBasis
        };
        task.parentRecurringTaskInfo = {
          taskId: new ObjectId(),
          startDate: new Date(2024, 0, 1)
        };
        DashboardTaskService.updateDatesForRecurrence(task);
        expect(task.startDate).toEqual(new Date(2024, 0, 9));
        expect(task.dueDate).toEqual(new Date(2024, 0, 14));
      });

      it('should update the start date correctly for a weekly recurrence', () => {
        const task = new DashboardTask(new ObjectId());
        task.startDate = new Date(2024, 0, 1);
        task.recurrenceInfo = {
          frequency: {
            type: RecurrenceFrequencyType.everyXTimeUnit,
            everyXTimeUnit: {
              timeUnit: 'week',
              x: 1
            }
          },
          recurrenceBasis: RecurrenceBasis.startDate,
          recurrenceEffect: RecurrenceEffect.rollOnBasis
        };
        DashboardTaskService.updateDatesForRecurrence(task);
        expect(task.startDate).toEqual(new Date(2024, 0, 8));
      });

      it('should update the start and due date correctly for a weekDaySet reccurence', () => {
        const task = new DashboardTask(new ObjectId());
        task.startDate = new Date(2024, 0, 1, 11);
        task.dueDate = new Date(2024, 0, 4, 23, 59);
        task.recurrenceInfo = {
          frequency: {
            type: RecurrenceFrequencyType.weekDaySet,
            weekDaySet: [0, 5]
          },
          recurrenceBasis: RecurrenceBasis.startDate,
          recurrenceEffect: RecurrenceEffect.rollOnBasis
        };
        DashboardTaskService.updateDatesForRecurrence(task);
        expect(task.startDate).toEqual(new Date(2024, 0, 5, 11));
        expect(task.dueDate).toEqual(new Date(2024, 0, 8, 23, 59));
      });

      it('should update the start and due date correctly for a everyXWeekdayOfMonth reccurence', () => {
        const task = new DashboardTask(new ObjectId());
        task.startDate = new Date(2024, 0, 1, 11);
        task.dueDate = new Date(2024, 0, 4, 23, 59);
        task.recurrenceInfo = {
          frequency: {
            type: RecurrenceFrequencyType.everyXWeekdayOfMonth,
            everyXWeekdayOfMonth: {
              weekDay: 0,
              weekOfMonth: 1
            }
          },
          recurrenceBasis: RecurrenceBasis.startDate,
          recurrenceEffect: RecurrenceEffect.rollOnBasis
        };
        DashboardTaskService.updateDatesForRecurrence(task);
        expect(task.startDate).toEqual(new Date(2024, 0, 7, 11));
        expect(task.dueDate).toEqual(new Date(2024, 0, 10, 23, 59));
      });
    });
  });
});
