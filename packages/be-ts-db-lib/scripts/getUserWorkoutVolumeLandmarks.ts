import type { WorkoutExercise, WorkoutMuscleGroupVolumeCTO } from '@aneuhold/core-ts-db-lib';
import { DocumentService, WorkoutVolumePlanningService } from '@aneuhold/core-ts-db-lib';
import type { UUID } from 'crypto';
import dotenv from 'dotenv';
import WorkoutExerciseRepository from '../src/repositories/workout/WorkoutExerciseRepository.js';
import WorkoutMuscleGroupRepository from '../src/repositories/workout/WorkoutMuscleGroupRepository.js';
import DocumentDb from '../src/util/DocumentDb.js';

dotenv.config({ path: '../../.env' });

/**
 * Indent unit for hierarchical output.
 */
const PAD = '  ';

/**
 * Pre-indexed data used by the formatter.
 */
type LandmarkData = {
  volumeCTOs: WorkoutMuscleGroupVolumeCTO[];
  exercises: WorkoutExercise[];
  muscleGroupNameById: Map<UUID, string>;
};

/**
 * Fetches all exercises, muscle groups, and per-muscle-group volume CTOs
 * for the user, indexing muscle group names for friendly output.
 *
 * @param userId The user whose volume landmark data to fetch.
 */
const fetchLandmarkData = async (userId: UUID): Promise<LandmarkData> => {
  const [volumeCTOs, exercises, muscleGroups] = await Promise.all([
    WorkoutMuscleGroupRepository.getRepo().buildMuscleGroupVolumeCTOsForUser(userId),
    WorkoutExerciseRepository.getRepo().getAllForUser(userId),
    WorkoutMuscleGroupRepository.getRepo().getAllForUser(userId)
  ]);

  const muscleGroupNameById = new Map<UUID, string>(muscleGroups.map((mg) => [mg._id, mg.name]));

  return { volumeCTOs, exercises, muscleGroupNameById };
};

const formatNumber = (n: number | null | undefined): string => {
  if (n == null) return '—';
  if (Number.isInteger(n)) return n.toString();
  return n.toFixed(2).replace(/\.?0+$/, '');
};

const formatDate = (d: Date | null | undefined): string => {
  if (d == null) return '—';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const renderExercise = (ex: WorkoutExercise, data: LandmarkData): string[] => {
  const primary = ex.primaryMuscleGroups
    .map((id) => data.muscleGroupNameById.get(id) ?? id)
    .join(', ');
  const secondary = ex.secondaryMuscleGroups
    .map((id) => data.muscleGroupNameById.get(id) ?? id)
    .join(', ');
  return [
    `${PAD}🏃 ${ex.exerciseName}`,
    `${PAD}${PAD}primary:   [${primary}]`,
    `${PAD}${PAD}secondary: [${secondary}]`
  ];
};

const renderMuscleGroupVolume = (cto: WorkoutMuscleGroupVolumeCTO): string[] => {
  if (cto.mesocycleHistory.length === 0) {
    return [`${PAD}💪 ${cto.name}  (no history)`];
  }

  const estimate = WorkoutVolumePlanningService.estimateVolumeLandmarks(cto);
  const lines: string[] = [
    `${PAD}💪 ${cto.name}  ` +
      `MEV=${estimate.estimatedMev}  MAV=${estimate.estimatedMav}  MRV=${estimate.estimatedMrv}  ` +
      `(n=${estimate.mesocycleCount} mesos)`
  ];

  for (const m of cto.mesocycleHistory) {
    const summary =
      `start=${m.startingSetCount}  peak=${m.peakSetCount}  ` +
      `avgRSM=${formatNumber(m.avgRsm)}  avgPerf=${formatNumber(m.avgPerformanceScore)}  ` +
      `recoverySess=${m.recoverySessionCount}`;
    lines.push(`${PAD}${PAD}▸ ${m.cycleType} meso  ${formatDate(m.completedDate)}  ${summary}`);
  }
  return lines;
};

const renderData = (userId: UUID, data: LandmarkData): string => {
  const lines: string[] = [];
  lines.push(`🏋️ === Workout Volume Landmarks — User: ${userId} ===`);
  lines.push(
    `📊 Counts: ${data.exercises.length} exercises | ${data.volumeCTOs.length} muscle groups`
  );

  lines.push('');
  lines.push('━'.repeat(72));
  lines.push('🧬 EXERCISE MUSCLE GROUP MAP');
  const sortedExercises = [...data.exercises].sort((a, b) =>
    a.exerciseName.localeCompare(b.exerciseName)
  );
  for (const ex of sortedExercises) {
    lines.push(...renderExercise(ex, data));
  }

  lines.push('');
  lines.push('━'.repeat(72));
  lines.push('📈 VOLUME LANDMARKS PER MUSCLE GROUP');
  const sortedCTOs = [...data.volumeCTOs].sort((a, b) => a.name.localeCompare(b.name));
  for (const cto of sortedCTOs) {
    lines.push(...renderMuscleGroupVolume(cto));
  }

  return lines.join('\n');
};

const main = async (): Promise<void> => {
  const userIdArg = process.argv[2];
  if (!userIdArg) {
    console.error('Usage: tsx ./scripts/getUserWorkoutVolumeLandmarks.ts <userId>');
    process.exit(1);
  }
  const userId = DocumentService.toUUID(userIdArg);
  try {
    const data = await fetchLandmarkData(userId);
    console.log(renderData(userId, data));
  } finally {
    await DocumentDb.closeDbConnection();
  }
};

void main().then(() => process.exit(0));
