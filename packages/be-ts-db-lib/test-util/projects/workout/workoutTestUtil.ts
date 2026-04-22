import {
  CycleType,
  DocumentService,
  ExerciseRepRange,
  UserSchema,
  WorkoutEquipmentTypeSchema,
  WorkoutExerciseCalibrationSchema,
  WorkoutExerciseSchema,
  WorkoutMesocycleSchema,
  WorkoutMicrocycleSchema,
  WorkoutMuscleGroupSchema,
  WorkoutSessionExerciseSchema,
  WorkoutSessionSchema,
  WorkoutSetSchema,
  type User,
  type WorkoutEquipmentType,
  type WorkoutExercise,
  type WorkoutExerciseCalibration,
  type WorkoutMesocycle,
  type WorkoutMicrocycle,
  type WorkoutMuscleGroup,
  type WorkoutSession,
  type WorkoutSessionExercise,
  type WorkoutSet
} from '@aneuhold/core-ts-db-lib';
import type { UUID } from 'crypto';
import UserRepository from '../../../src/repositories/common/UserRepository.js';
import WorkoutEquipmentTypeRepository from '../../../src/repositories/workout/WorkoutEquipmentTypeRepository.js';
import WorkoutExerciseCalibrationRepository from '../../../src/repositories/workout/WorkoutExerciseCalibrationRepository.js';
import WorkoutExerciseRepository from '../../../src/repositories/workout/WorkoutExerciseRepository.js';
import WorkoutMesocycleRepository from '../../../src/repositories/workout/WorkoutMesocycleRepository.js';
import WorkoutMicrocycleRepository from '../../../src/repositories/workout/WorkoutMicrocycleRepository.js';
import WorkoutMuscleGroupRepository from '../../../src/repositories/workout/WorkoutMuscleGroupRepository.js';
import WorkoutSessionExerciseRepository from '../../../src/repositories/workout/WorkoutSessionExerciseRepository.js';
import WorkoutSessionRepository from '../../../src/repositories/workout/WorkoutSessionRepository.js';
import WorkoutSetRepository from '../../../src/repositories/workout/WorkoutSetRepository.js';
import DbOperationMetaData from '../../../src/util/DbOperationMetaData.js';
import { getTestUserName } from '../../testsUtil.js';

/**
 * Shared test utility for creating and inserting workout-related documents.
 *
 * - `createX()` methods parse via Zod schema and return unpersisted documents.
 * - `insertX()` methods create + insert via repository and return the inserted document.
 * - Convenience methods (`insertExerciseSetup`, `insertSessionSetup`) batch-insert
 *   related documents in parallel using {@link DbOperationMetaData}.
 *
 * Cleanup is handled by the global vitest.setup.ts teardown which cascade-deletes
 * all test users.
 */
class WorkoutTestUtil {
  /**
   * Creates an unpersisted test user document.
   *
   * @param prefix - Prefix appended to the generated test user name.
   */
  createUser(prefix: string): User {
    return UserSchema.parse({ userName: getTestUserName(prefix) });
  }

  /**
   * Creates an unpersisted muscle group document.
   *
   * @param userId - Owner of the muscle group.
   * @param name - Display name for the muscle group.
   */
  createMuscleGroup(userId: UUID, name = 'Test Muscle Group'): WorkoutMuscleGroup {
    return WorkoutMuscleGroupSchema.parse({ userId, name });
  }

  /**
   * Creates an unpersisted equipment type document.
   *
   * @param userId - Owner of the equipment type.
   * @param title - Display title for the equipment type.
   */
  createEquipmentType(userId: UUID, title = 'Barbell'): WorkoutEquipmentType {
    return WorkoutEquipmentTypeSchema.parse({
      userId,
      title,
      weightOptions: [45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100]
    });
  }

  /**
   * Creates an unpersisted exercise document.
   *
   * @param options - Exercise configuration.
   * @param options.userId - Owner of the exercise.
   * @param options.equipmentTypeId - Equipment type to associate.
   * @param options.primaryMuscleGroupIds - Primary muscle groups targeted.
   * @param options.secondaryMuscleGroupIds - Secondary muscle groups targeted.
   * @param options.name - Display name for the exercise.
   * @param options.repRange - Rep range category for the exercise.
   */
  createExercise(options: {
    userId: UUID;
    equipmentTypeId: UUID;
    primaryMuscleGroupIds: UUID[];
    secondaryMuscleGroupIds?: UUID[];
    name?: string;
    repRange?: ExerciseRepRange;
  }): WorkoutExercise {
    const {
      userId,
      equipmentTypeId,
      primaryMuscleGroupIds,
      secondaryMuscleGroupIds = [],
      name = 'Test Exercise',
      repRange = ExerciseRepRange.Medium
    } = options;
    return WorkoutExerciseSchema.parse({
      userId,
      exerciseName: name,
      workoutEquipmentTypeId: equipmentTypeId,
      primaryMuscleGroups: primaryMuscleGroupIds,
      secondaryMuscleGroups: secondaryMuscleGroupIds,
      repRange,
      initialFatigueGuess: {}
    });
  }

  /**
   * Creates an unpersisted calibration document.
   *
   * @param options - Calibration configuration.
   * @param options.userId - Owner of the calibration.
   * @param options.exerciseId - Exercise to calibrate.
   * @param options.weight - Weight used in the calibration.
   * @param options.reps - Reps performed in the calibration.
   */
  createCalibration(options: {
    userId: UUID;
    exerciseId: UUID;
    weight?: number;
    reps?: number;
  }): WorkoutExerciseCalibration {
    const { userId, exerciseId, weight = 100, reps = 8 } = options;
    return WorkoutExerciseCalibrationSchema.parse({
      userId,
      workoutExerciseId: exerciseId,
      weight,
      reps,
      exerciseProperties: {}
    });
  }

  /**
   * Creates an unpersisted mesocycle document.
   *
   * @param options - Mesocycle configuration.
   * @param options.userId - Owner of the mesocycle.
   * @param options.calibratedExerciseIds - Exercises included in the mesocycle.
   * @param options.completedDate - Date the mesocycle was completed.
   * @param options.plannedSessionCountPerMicrocycle - Sessions per microcycle.
   * @param options.plannedMicrocycleCount - Total number of microcycles.
   * @param options.title - Display title for the mesocycle.
   * @param options.cycleType - Type of training cycle.
   */
  createMesocycle(options: {
    userId: UUID;
    calibratedExerciseIds?: UUID[];
    completedDate?: Date;
    plannedSessionCountPerMicrocycle?: number;
    plannedMicrocycleCount?: number;
    title?: string;
    cycleType?: CycleType;
  }): WorkoutMesocycle {
    const {
      userId,
      calibratedExerciseIds = [DocumentService.generateID()],
      completedDate,
      plannedSessionCountPerMicrocycle = 1,
      plannedMicrocycleCount = 3,
      title,
      cycleType = CycleType.MuscleGain
    } = options;
    return WorkoutMesocycleSchema.parse({
      userId,
      title,
      cycleType,
      plannedMicrocycleLengthInDays: 7,
      plannedSessionCountPerMicrocycle,
      plannedMicrocycleRestDays: [],
      plannedMicrocycleCount,
      calibratedExercises: calibratedExerciseIds,
      completedDate
    });
  }

  /**
   * Creates an unpersisted microcycle document.
   *
   * @param options - Microcycle configuration.
   * @param options.userId - Owner of the microcycle.
   * @param options.mesocycleId - Parent mesocycle.
   * @param options.startDate - Start date of the microcycle.
   * @param options.endDate - End date of the microcycle.
   */
  createMicrocycle(options: {
    userId: UUID;
    mesocycleId: UUID;
    startDate?: Date;
    endDate?: Date;
  }): WorkoutMicrocycle {
    const {
      userId,
      mesocycleId,
      startDate = new Date(),
      endDate = new Date(Date.now() + 7 * 86400000)
    } = options;
    return WorkoutMicrocycleSchema.parse({
      userId,
      workoutMesocycleId: mesocycleId,
      startDate,
      endDate
    });
  }

  /**
   * Creates an unpersisted session document.
   *
   * @param options - Session configuration.
   * @param options.userId - Owner of the session.
   * @param options.microcycleId - Parent microcycle.
   * @param options.complete - Whether the session is marked complete.
   * @param options.startTime - When the session started.
   * @param options.title - Display title for the session.
   */
  createSession(options: {
    userId: UUID;
    microcycleId: UUID;
    complete?: boolean;
    startTime?: Date;
    title?: string;
  }): WorkoutSession {
    const {
      userId,
      microcycleId,
      complete = false,
      startTime = new Date(),
      title = 'Test Session'
    } = options;
    return WorkoutSessionSchema.parse({
      userId,
      workoutMicrocycleId: microcycleId,
      title,
      startTime,
      complete
    });
  }

  /**
   * Creates an unpersisted session exercise document.
   *
   * @param options - Session exercise configuration.
   * @param options.userId - Owner of the session exercise.
   * @param options.sessionId - Parent session.
   * @param options.exerciseId - Exercise being performed.
   * @param options.isRecoveryExercise - Whether this is a recovery exercise.
   * @param options.sorenessScore - Soreness score for the session exercise.
   * @param options.performanceScore - Performance score for the session exercise.
   * @param options.rsm - RSM (recovery stimulus magnitude) breakdown.
   */
  createSessionExercise(options: {
    userId: UUID;
    sessionId: UUID;
    exerciseId: UUID;
    isRecoveryExercise?: boolean;
    sorenessScore?: number | null;
    performanceScore?: number | null;
    rsm?: { mindMuscleConnection: number; pump: number; disruption: number } | null;
  }): WorkoutSessionExercise {
    const {
      userId,
      sessionId,
      exerciseId,
      isRecoveryExercise = false,
      sorenessScore,
      performanceScore,
      rsm
    } = options;
    return WorkoutSessionExerciseSchema.parse({
      userId,
      workoutSessionId: sessionId,
      workoutExerciseId: exerciseId,
      isRecoveryExercise,
      sorenessScore,
      performanceScore,
      rsm
    });
  }

  /**
   * Creates an unpersisted set document.
   *
   * @param options - Set configuration.
   * @param options.userId - Owner of the set.
   * @param options.exerciseId - Exercise being performed.
   * @param options.sessionId - Parent session.
   * @param options.sessionExerciseId - Parent session exercise.
   * @param options.plannedRir - Planned reps in reserve.
   * @param options.actualWeight - Actual weight used.
   * @param options.actualReps - Actual reps performed.
   */
  createSet(options: {
    userId: UUID;
    exerciseId: UUID;
    sessionId: UUID;
    sessionExerciseId: UUID;
    plannedRir?: number | null;
    actualWeight?: number | null;
    actualReps?: number | null;
  }): WorkoutSet {
    const {
      userId,
      exerciseId,
      sessionId,
      sessionExerciseId,
      plannedRir = 2,
      actualWeight = 80,
      actualReps = 8
    } = options;
    return WorkoutSetSchema.parse({
      userId,
      workoutExerciseId: exerciseId,
      workoutSessionId: sessionId,
      workoutSessionExerciseId: sessionExerciseId,
      plannedRir,
      actualWeight,
      actualReps,
      exerciseProperties: {}
    });
  }

  /**
   * Creates and inserts a test user.
   *
   * @param prefix - Prefix appended to the generated test user name.
   */
  async insertUser(prefix: string): Promise<User> {
    const user = this.createUser(prefix);
    const result = await UserRepository.getRepo().insertNew(user);
    if (!result) throw new Error('Failed to insert test user');
    return result;
  }

  /**
   * Creates and inserts a muscle group.
   *
   * @param userId - Owner of the muscle group.
   * @param name - Display name for the muscle group.
   */
  async insertMuscleGroup(userId: UUID, name = 'Test Muscle Group'): Promise<WorkoutMuscleGroup> {
    const mg = this.createMuscleGroup(userId, name);
    const result = await WorkoutMuscleGroupRepository.getRepo().insertNew(mg);
    if (!result) throw new Error(`Failed to insert muscle group: ${name}`);
    return result;
  }

  /**
   * Creates and inserts an equipment type.
   *
   * @param userId - Owner of the equipment type.
   * @param title - Display title for the equipment type.
   */
  async insertEquipmentType(userId: UUID, title = 'Barbell'): Promise<WorkoutEquipmentType> {
    const eq = this.createEquipmentType(userId, title);
    const result = await WorkoutEquipmentTypeRepository.getRepo().insertNew(eq);
    if (!result) throw new Error(`Failed to insert equipment type: ${title}`);
    return result;
  }

  /**
   * Creates and inserts an exercise.
   *
   * @param options - Exercise configuration.
   * @param options.userId - Owner of the exercise.
   * @param options.equipmentTypeId - Equipment type to associate.
   * @param options.primaryMuscleGroupIds - Primary muscle groups targeted.
   * @param options.secondaryMuscleGroupIds - Secondary muscle groups targeted.
   * @param options.name - Display name for the exercise.
   * @param options.repRange - Rep range category for the exercise.
   */
  async insertExercise(options: {
    userId: UUID;
    equipmentTypeId: UUID;
    primaryMuscleGroupIds: UUID[];
    secondaryMuscleGroupIds?: UUID[];
    name?: string;
    repRange?: ExerciseRepRange;
  }): Promise<WorkoutExercise> {
    const name = options.name ?? 'Test Exercise';
    const ex = this.createExercise(options);
    const result = await WorkoutExerciseRepository.getRepo().insertNew(ex);
    if (!result) throw new Error(`Failed to insert exercise: ${name}`);
    return result;
  }

  /**
   * Creates and inserts a calibration.
   *
   * @param options - Calibration configuration.
   * @param options.userId - Owner of the calibration.
   * @param options.exerciseId - Exercise to calibrate.
   * @param options.weight - Weight used in the calibration.
   * @param options.reps - Reps performed in the calibration.
   */
  async insertCalibration(options: {
    userId: UUID;
    exerciseId: UUID;
    weight?: number;
    reps?: number;
  }): Promise<WorkoutExerciseCalibration> {
    const cal = this.createCalibration(options);
    const result = await WorkoutExerciseCalibrationRepository.getRepo().insertNew(cal);
    if (!result) throw new Error('Failed to insert calibration');
    return result;
  }

  /**
   * Creates and inserts a mesocycle.
   *
   * @param options - Mesocycle configuration.
   * @param options.userId - Owner of the mesocycle.
   * @param options.calibratedExerciseIds - Exercises included in the mesocycle.
   * @param options.completedDate - Date the mesocycle was completed.
   * @param options.plannedSessionCountPerMicrocycle - Sessions per microcycle.
   * @param options.plannedMicrocycleCount - Total number of microcycles.
   * @param options.title - Display title for the mesocycle.
   * @param options.cycleType - Type of training cycle.
   */
  async insertMesocycle(options: {
    userId: UUID;
    calibratedExerciseIds?: UUID[];
    completedDate?: Date;
    plannedSessionCountPerMicrocycle?: number;
    plannedMicrocycleCount?: number;
    title?: string;
    cycleType?: CycleType;
  }): Promise<WorkoutMesocycle> {
    const meso = this.createMesocycle(options);
    const result = await WorkoutMesocycleRepository.getRepo().insertNew(meso);
    if (!result) throw new Error('Failed to insert mesocycle');
    return result;
  }

  /**
   * Creates and inserts a microcycle.
   *
   * @param options - Microcycle configuration.
   * @param options.userId - Owner of the microcycle.
   * @param options.mesocycleId - Parent mesocycle.
   * @param options.startDate - Start date of the microcycle.
   * @param options.endDate - End date of the microcycle.
   */
  async insertMicrocycle(options: {
    userId: UUID;
    mesocycleId: UUID;
    startDate?: Date;
    endDate?: Date;
  }): Promise<WorkoutMicrocycle> {
    const micro = this.createMicrocycle(options);
    const result = await WorkoutMicrocycleRepository.getRepo().insertNew(micro);
    if (!result) throw new Error('Failed to insert microcycle');
    return result;
  }

  /**
   * Creates and inserts a session.
   *
   * @param options - Session configuration.
   * @param options.userId - Owner of the session.
   * @param options.microcycleId - Parent microcycle.
   * @param options.complete - Whether the session is marked complete.
   * @param options.startTime - When the session started.
   * @param options.title - Display title for the session.
   */
  async insertSession(options: {
    userId: UUID;
    microcycleId: UUID;
    complete?: boolean;
    startTime?: Date;
    title?: string;
  }): Promise<WorkoutSession> {
    const session = this.createSession(options);
    const result = await WorkoutSessionRepository.getRepo().insertNew(session);
    if (!result) throw new Error('Failed to insert session');
    return result;
  }

  /**
   * Creates and inserts a session exercise.
   *
   * @param options - Session exercise configuration.
   * @param options.userId - Owner of the session exercise.
   * @param options.sessionId - Parent session.
   * @param options.exerciseId - Exercise being performed.
   * @param options.isRecoveryExercise - Whether this is a recovery exercise.
   * @param options.sorenessScore - Soreness score for the session exercise.
   * @param options.performanceScore - Performance score for the session exercise.
   * @param options.rsm - RSM (recovery stimulus magnitude) breakdown.
   */
  async insertSessionExercise(options: {
    userId: UUID;
    sessionId: UUID;
    exerciseId: UUID;
    isRecoveryExercise?: boolean;
    sorenessScore?: number | null;
    performanceScore?: number | null;
    rsm?: { mindMuscleConnection: number; pump: number; disruption: number } | null;
  }): Promise<WorkoutSessionExercise> {
    const se = this.createSessionExercise(options);
    const result = await WorkoutSessionExerciseRepository.getRepo().insertNew(se);
    if (!result) throw new Error('Failed to insert session exercise');
    return result;
  }

  /**
   * Creates and inserts a single set. Does not update the session exercise's
   * setOrder — callers that need setOrder should use
   * {@link insertSessionHierarchy} or manage it themselves.
   *
   * @param options - Set configuration.
   * @param options.userId - Owner of the set.
   * @param options.exerciseId - Exercise being performed.
   * @param options.sessionId - Parent session.
   * @param options.sessionExerciseId - Parent session exercise.
   * @param options.plannedRir - Planned reps in reserve.
   * @param options.actualWeight - Actual weight used.
   * @param options.actualReps - Actual reps performed.
   */
  async insertSet(options: {
    userId: UUID;
    exerciseId: UUID;
    sessionId: UUID;
    sessionExerciseId: UUID;
    plannedRir?: number | null;
    actualWeight?: number | null;
    actualReps?: number | null;
  }): Promise<WorkoutSet> {
    const set = this.createSet(options);
    const result = await WorkoutSetRepository.getRepo().insertNew(set);
    if (!result) throw new Error('Failed to insert set');
    return result;
  }

  // ---------------------------------------------------------------------------
  // Convenience methods — batch-insert related document graphs in parallel
  // ---------------------------------------------------------------------------

  /**
   * Creates and inserts a test user, muscle group, equipment type, and exercise.
   * The user is inserted first, then the remaining 3 documents are batch-inserted
   * in parallel using {@link DbOperationMetaData}.
   *
   * @param options - Setup configuration.
   * @param options.prefix - Prefix for the test user name.
   * @param options.exerciseName - Name for the exercise.
   */
  async insertExerciseSetup(options: { prefix: string; exerciseName?: string }): Promise<{
    testUser: User;
    muscleGroup: WorkoutMuscleGroup;
    equipmentType: WorkoutEquipmentType;
    exercise: WorkoutExercise;
  }> {
    const { prefix, exerciseName = 'Test Exercise' } = options;

    const testUser = await this.insertUser(prefix);

    const muscleGroup = this.createMuscleGroup(testUser._id, `Muscle-${exerciseName}`);
    const equipmentType = this.createEquipmentType(testUser._id, `Equipment-${exerciseName}`);
    const exercise = this.createExercise({
      userId: testUser._id,
      equipmentTypeId: equipmentType._id,
      primaryMuscleGroupIds: [muscleGroup._id],
      name: exerciseName
    });

    const meta = new DbOperationMetaData();
    meta.registerPendingDocs([muscleGroup, equipmentType, exercise]);

    await Promise.all([
      WorkoutMuscleGroupRepository.getRepo().insertMany([muscleGroup], meta),
      WorkoutEquipmentTypeRepository.getRepo().insertMany([equipmentType], meta),
      WorkoutExerciseRepository.getRepo().insertMany([exercise], meta)
    ]);

    return { testUser, muscleGroup, equipmentType, exercise };
  }

  /**
   * Creates and inserts a muscle group, equipment type, exercise, mesocycle,
   * microcycle, and session for a given user. All 6 documents are batch-inserted
   * in parallel using {@link DbOperationMetaData}.
   *
   * @param options - Setup configuration.
   * @param options.userId - Owner of all created documents (must already exist).
   * @param options.exerciseName - Name for the exercise.
   */
  async insertSessionSetup(options: { userId: UUID; exerciseName?: string }): Promise<{
    muscleGroup: WorkoutMuscleGroup;
    equipmentType: WorkoutEquipmentType;
    exercise: WorkoutExercise;
    mesocycle: WorkoutMesocycle;
    microcycle: WorkoutMicrocycle;
    session: WorkoutSession;
  }> {
    const { userId, exerciseName = 'Test Exercise' } = options;

    const muscleGroup = this.createMuscleGroup(userId, `Muscle-${exerciseName}`);
    const equipmentType = this.createEquipmentType(userId, `Equipment-${exerciseName}`);
    const exercise = this.createExercise({
      userId,
      equipmentTypeId: equipmentType._id,
      primaryMuscleGroupIds: [muscleGroup._id],
      name: exerciseName
    });
    const mesocycle = this.createMesocycle({ userId });
    const microcycle = this.createMicrocycle({ userId, mesocycleId: mesocycle._id });
    const session = this.createSession({ userId, microcycleId: microcycle._id });

    const meta = new DbOperationMetaData();
    meta.registerPendingDocs([
      muscleGroup,
      equipmentType,
      exercise,
      mesocycle,
      microcycle,
      session
    ]);

    await Promise.all([
      WorkoutMuscleGroupRepository.getRepo().insertMany([muscleGroup], meta),
      WorkoutEquipmentTypeRepository.getRepo().insertMany([equipmentType], meta),
      WorkoutExerciseRepository.getRepo().insertMany([exercise], meta),
      WorkoutMesocycleRepository.getRepo().insertMany([mesocycle], meta),
      WorkoutMicrocycleRepository.getRepo().insertMany([microcycle], meta),
      WorkoutSessionRepository.getRepo().insertMany([session], meta)
    ]);

    return { muscleGroup, equipmentType, exercise, mesocycle, microcycle, session };
  }

  /**
   * Creates a full session hierarchy (mesocycle -> microcycle -> session ->
   * session exercise -> sets) for a given exercise. All documents are created
   * in memory, registered as pending, then batch-inserted in parallel using
   * {@link DbOperationMetaData}.
   *
   * @param userId - Owner of all created documents.
   * @param exercise - The exercise to create the hierarchy for.
   * @param options - Hierarchy configuration.
   * @param options.complete - Whether the session is marked complete.
   * @param options.startTime - When the session started.
   * @param options.plannedRir - Planned reps in reserve for each set.
   * @param options.actualWeight - Actual weight used for each set.
   * @param options.actualReps - Actual reps performed for each set.
   * @param options.setCount - Number of sets to create.
   * @param options.isRecoveryExercise - Whether this is a recovery exercise.
   */
  async insertSessionHierarchy(
    userId: UUID,
    exercise: WorkoutExercise,
    options: {
      complete?: boolean;
      startTime?: Date;
      plannedRir?: number | null;
      actualWeight?: number | null;
      actualReps?: number | null;
      setCount?: number;
      isRecoveryExercise?: boolean;
    } = {}
  ) {
    const {
      complete = true,
      startTime = new Date(),
      plannedRir = 2,
      actualWeight = 80,
      actualReps = 8,
      setCount = 2,
      isRecoveryExercise = false
    } = options;

    const mesocycle = this.createMesocycle({
      userId,
      calibratedExerciseIds: [exercise._id]
    });
    const microcycle = this.createMicrocycle({ userId, mesocycleId: mesocycle._id });
    const session = this.createSession({
      userId,
      microcycleId: microcycle._id,
      complete,
      startTime
    });
    const sessionExercise = this.createSessionExercise({
      userId,
      sessionId: session._id,
      exerciseId: exercise._id,
      isRecoveryExercise
    });

    const sets: WorkoutSet[] = [];
    for (let i = 0; i < setCount; i++) {
      sets.push(
        this.createSet({
          userId,
          exerciseId: exercise._id,
          sessionId: session._id,
          sessionExerciseId: sessionExercise._id,
          plannedRir,
          actualWeight,
          actualReps
        })
      );
    }

    sessionExercise.setOrder = sets.map((s) => s._id);

    const meta = new DbOperationMetaData();
    meta.registerPendingDocs([mesocycle, microcycle, session, sessionExercise, ...sets]);

    await Promise.all([
      WorkoutMesocycleRepository.getRepo().insertMany([mesocycle], meta),
      WorkoutMicrocycleRepository.getRepo().insertMany([microcycle], meta),
      WorkoutSessionRepository.getRepo().insertMany([session], meta),
      WorkoutSessionExerciseRepository.getRepo().insertMany([sessionExercise], meta),
      WorkoutSetRepository.getRepo().insertMany(sets, meta)
    ]);

    return { mesocycle, microcycle, session, sessionExercise, sets };
  }

  /**
   * Creates a completed mesocycle with the specified number of microcycles,
   * each containing one session with one session exercise and sets. All
   * documents are created in memory, registered as pending, then batch-inserted
   * in parallel using {@link DbOperationMetaData}.
   *
   * @param userId - Owner of all created documents.
   * @param exercise - The exercise performed in every session.
   * @param options - Mesocycle configuration.
   * @param options.completedDate - Date the mesocycle was completed.
   * @param options.microcycleCount - Number of microcycles to create.
   * @param options.setsPerMicrocycle - Array of set counts per microcycle.
   * @param options.sorenessScore - Soreness score for each session exercise.
   * @param options.performanceScore - Performance score for each session exercise.
   * @param options.rsm - RSM breakdown for each session exercise.
   * @param options.isRecoveryExercise - Whether exercises are recovery exercises.
   */
  async insertCompletedMesocycle(
    userId: UUID,
    exercise: WorkoutExercise,
    options: {
      completedDate?: Date;
      microcycleCount?: number;
      setsPerMicrocycle?: number[];
      sorenessScore?: number | null;
      performanceScore?: number | null;
      rsm?: { mindMuscleConnection: number; pump: number; disruption: number } | null;
      isRecoveryExercise?: boolean;
    } = {}
  ) {
    const {
      completedDate = new Date(),
      microcycleCount = 2,
      setsPerMicrocycle,
      sorenessScore = null,
      performanceScore = null,
      rsm = null,
      isRecoveryExercise = false
    } = options;

    const setCountsPerMicro: number[] =
      setsPerMicrocycle ?? Array.from({ length: microcycleCount }, () => 3);

    const mesocycle = this.createMesocycle({
      userId,
      calibratedExerciseIds: [exercise._id],
      completedDate,
      plannedMicrocycleCount: microcycleCount
    });

    const microcycles: WorkoutMicrocycle[] = [];
    const sessions: WorkoutSession[] = [];
    const sessionExercises: WorkoutSessionExercise[] = [];
    const allSets: WorkoutSet[] = [];

    for (let i = 0; i < microcycleCount; i++) {
      const baseDate = new Date(completedDate);
      baseDate.setDate(baseDate.getDate() - (microcycleCount - i) * 7);

      const micro = this.createMicrocycle({
        userId,
        mesocycleId: mesocycle._id,
        startDate: baseDate,
        endDate: new Date(baseDate.getTime() + 7 * 86400000)
      });
      microcycles.push(micro);

      const session = this.createSession({
        userId,
        microcycleId: micro._id,
        title: `Session ${i + 1}`,
        startTime: baseDate,
        complete: true
      });
      sessions.push(session);

      const se = this.createSessionExercise({
        userId,
        sessionId: session._id,
        exerciseId: exercise._id,
        isRecoveryExercise,
        sorenessScore,
        performanceScore,
        rsm
      });

      const sets: WorkoutSet[] = [];
      for (let j = 0; j < setCountsPerMicro[i]; j++) {
        sets.push(
          this.createSet({
            userId,
            exerciseId: exercise._id,
            sessionId: session._id,
            sessionExerciseId: se._id,
            plannedRir: 2,
            actualWeight: 80,
            actualReps: 8
          })
        );
      }

      se.setOrder = sets.map((s) => s._id);
      sessionExercises.push(se);
      allSets.push(...sets);
    }

    const meta = new DbOperationMetaData();
    meta.registerPendingDocs([
      mesocycle,
      ...microcycles,
      ...sessions,
      ...sessionExercises,
      ...allSets
    ]);

    await Promise.all([
      WorkoutMesocycleRepository.getRepo().insertMany([mesocycle], meta),
      WorkoutMicrocycleRepository.getRepo().insertMany(microcycles, meta),
      WorkoutSessionRepository.getRepo().insertMany(sessions, meta),
      WorkoutSessionExerciseRepository.getRepo().insertMany(sessionExercises, meta),
      WorkoutSetRepository.getRepo().insertMany(allSets, meta)
    ]);

    return mesocycle;
  }
}

const workoutTestUtil = new WorkoutTestUtil();
export default workoutTestUtil;
