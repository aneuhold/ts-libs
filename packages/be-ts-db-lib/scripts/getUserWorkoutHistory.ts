import type {
  WorkoutEquipmentType,
  WorkoutExercise,
  WorkoutMesocycle,
  WorkoutMicrocycle,
  WorkoutSession,
  WorkoutSessionExercise,
  WorkoutSet
} from '@aneuhold/core-ts-db-lib';
import {
  DocumentService,
  WorkoutMesocycleService,
  WorkoutSessionExerciseService,
  WorkoutSessionService
} from '@aneuhold/core-ts-db-lib';
import type { UUID } from 'crypto';
import dotenv from 'dotenv';
import WorkoutEquipmentTypeRepository from '../src/repositories/workout/WorkoutEquipmentTypeRepository.js';
import WorkoutExerciseRepository from '../src/repositories/workout/WorkoutExerciseRepository.js';
import WorkoutMesocycleRepository from '../src/repositories/workout/WorkoutMesocycleRepository.js';
import WorkoutMicrocycleRepository from '../src/repositories/workout/WorkoutMicrocycleRepository.js';
import WorkoutSessionExerciseRepository from '../src/repositories/workout/WorkoutSessionExerciseRepository.js';
import WorkoutSessionRepository from '../src/repositories/workout/WorkoutSessionRepository.js';
import WorkoutSetRepository from '../src/repositories/workout/WorkoutSetRepository.js';
import DocumentDb from '../src/util/DocumentDb.js';

dotenv.config({ path: '../../.env' });

/**
 * Indent unit for hierarchical output.
 */
const PAD = '  ';

/**
 * Pre-indexed workout data used by the formatter.
 */
type WorkoutHistory = {
  mesocycles: WorkoutMesocycle[];
  orphanMicrocycles: WorkoutMicrocycle[];
  orphanSessions: WorkoutSession[];
  microcyclesByMesocycleId: Map<UUID, WorkoutMicrocycle[]>;
  sessionsByMicrocycleId: Map<UUID, WorkoutSession[]>;
  sessionExerciseMap: Map<UUID, WorkoutSessionExercise>;
  setMap: Map<UUID, WorkoutSet>;
  exerciseMap: Map<UUID, WorkoutExercise>;
  equipmentMap: Map<UUID, WorkoutEquipmentType>;
};

/**
 * Fetches every workout-related document for a user and indexes them by
 * parent so the formatter can walk the hierarchy without re-scanning lists.
 *
 * @param userId The user whose workout data to fetch.
 */
const fetchWorkoutHistory = async (userId: UUID): Promise<WorkoutHistory> => {
  const [mesocycles, microcycles, sessions, sessionExercises, sets, exercises, equipment] =
    await Promise.all([
      WorkoutMesocycleRepository.getRepo().getAllForUser(userId),
      WorkoutMicrocycleRepository.getRepo().getAllForUser(userId),
      WorkoutSessionRepository.getRepo().getAllForUser(userId),
      WorkoutSessionExerciseRepository.getRepo().getAllForUser(userId),
      WorkoutSetRepository.getRepo().getAllForUser(userId),
      WorkoutExerciseRepository.getRepo().getAllForUser(userId),
      WorkoutEquipmentTypeRepository.getRepo().getAllForUser(userId)
    ]);

  const microcyclesByMesocycleId = new Map<UUID, WorkoutMicrocycle[]>();
  const orphanMicrocycles: WorkoutMicrocycle[] = [];
  for (const mc of microcycles) {
    if (mc.workoutMesocycleId == null) {
      orphanMicrocycles.push(mc);
      continue;
    }
    const existing = microcyclesByMesocycleId.get(mc.workoutMesocycleId);
    if (existing) {
      existing.push(mc);
    } else {
      microcyclesByMesocycleId.set(mc.workoutMesocycleId, [mc]);
    }
  }

  const sessionsByMicrocycleId = new Map<UUID, WorkoutSession[]>();
  const orphanSessions: WorkoutSession[] = [];
  for (const session of sessions) {
    if (session.workoutMicrocycleId == null) {
      orphanSessions.push(session);
      continue;
    }
    const existing = sessionsByMicrocycleId.get(session.workoutMicrocycleId);
    if (existing) {
      existing.push(session);
    } else {
      sessionsByMicrocycleId.set(session.workoutMicrocycleId, [session]);
    }
  }

  return {
    mesocycles,
    orphanMicrocycles,
    orphanSessions,
    microcyclesByMesocycleId,
    sessionsByMicrocycleId,
    sessionExerciseMap: new Map(sessionExercises.map((se) => [se._id, se])),
    setMap: new Map(sets.map((s) => [s._id, s])),
    exerciseMap: new Map(exercises.map((e) => [e._id, e])),
    equipmentMap: new Map(equipment.map((eq) => [eq._id, eq]))
  };
};

const formatDate = (d: Date | null | undefined): string => {
  if (d == null) return '—';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateTime = (d: Date | null | undefined): string => {
  if (d == null) return '—';
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${formatDate(d)} ${hours}:${minutes}`;
};

const formatNumber = (n: number | null | undefined): string => {
  if (n == null) return '—';
  if (Number.isInteger(n)) return n.toString();
  return n.toFixed(2).replace(/\.?0+$/, '');
};

/**
 * Builds the planned/target side of a set: `10r@135 RIR3`, or `—` if no
 * planned data exists (rare; happens for fully free-form logging).
 *
 * @param set The set to format.
 */
const formatPlannedSet = (set: WorkoutSet): string => {
  const { plannedReps, plannedWeight, plannedRir } = set;
  if (plannedReps == null && plannedWeight == null && plannedRir == null) {
    return '—';
  }
  const reps = plannedReps == null ? '?r' : `${plannedReps}r`;
  const weight = plannedWeight == null ? '' : `@${formatNumber(plannedWeight)}`;
  const rir = plannedRir == null ? '' : ` RIR${plannedRir}`;
  return `${reps}${weight}${rir}`;
};

/**
 * Builds the actual side of a set. When no actual data has been recorded
 * the set is a projection (planned but not yet executed), shown as such.
 *
 * @param set The set to format.
 */
const formatActualSet = (set: WorkoutSet): string => {
  const { actualReps, actualWeight, rir } = set;
  if (actualReps == null && actualWeight == null && rir == null) {
    return '🔮 projected';
  }
  const reps = actualReps == null ? '?r' : `${actualReps}r`;
  const weight = actualWeight == null ? '' : `@${formatNumber(actualWeight)}`;
  const rirStr = rir == null ? '' : ` RIR${rir}`;
  return `${reps}${weight}${rirStr}`;
};

const formatExerciseProperties = (set: WorkoutSet): string => {
  if (!set.exerciseProperties) return '';
  const entries = Object.entries(set.exerciseProperties);
  if (entries.length === 0) return '';
  const parts = entries.map(([name, value]) => `${name}=${String(value)}`);
  return `  {${parts.join(', ')}}`;
};

const formatRsmFatigue = (
  rsmTotal: number | null,
  fatigueTotal: number | null,
  sfr: number | null
): string => {
  const parts: string[] = [];
  if (rsmTotal != null) parts.push(`⚡RSM:${rsmTotal}`);
  if (fatigueTotal != null) parts.push(`😓Fat:${fatigueTotal}`);
  if (sfr != null) parts.push(`⚖️SFR:${sfr.toFixed(2)}`);
  return parts.length === 0 ? '' : `  ${parts.join(' ')}`;
};

const renderSet = (set: WorkoutSet, index: number, indent: string): string => {
  const num = String(index + 1).padStart(2, ' ');
  return `${indent}#${num}  🎯 ${formatPlannedSet(set)}  │  ${formatActualSet(set)}${formatExerciseProperties(set)}`;
};

const renderSessionExercise = (
  se: WorkoutSessionExercise,
  history: WorkoutHistory,
  indent: string
): string[] => {
  const exercise = history.exerciseMap.get(se.workoutExerciseId);
  const equipment = exercise
    ? history.equipmentMap.get(exercise.workoutEquipmentTypeId)
    : undefined;
  const name = exercise?.exerciseName ?? `(unknown exercise ${se.workoutExerciseId})`;
  const equipTitle = equipment ? ` (${equipment.title})` : '';

  const flags: string[] = [];
  if (se.isRecoveryExercise) flags.push('🩹recovery');
  if (se.performanceScore != null) flags.push(`📈perf:${se.performanceScore}`);
  if (se.sorenessScore != null) flags.push(`💢sor:${se.sorenessScore}`);
  const flagStr = flags.length === 0 ? '' : `  ${flags.join(' ')}`;

  const rsmTotal = WorkoutSessionExerciseService.getRsmTotal(se);
  const fatigueTotal = WorkoutSessionExerciseService.getFatigueTotal(se);
  const sfr = WorkoutSessionExerciseService.getSFR(se);

  const lines: string[] = [
    `${indent}🏃 ${name}${equipTitle}${flagStr}${formatRsmFatigue(rsmTotal, fatigueTotal, sfr)}`
  ];

  const setIndent = indent + PAD;
  if (se.setOrder.length === 0) {
    lines.push(`${setIndent}(no sets)`);
    return lines;
  }
  for (let i = 0; i < se.setOrder.length; i++) {
    const set = history.setMap.get(se.setOrder[i]);
    if (!set) continue;
    lines.push(renderSet(set, i, setIndent));
  }
  return lines;
};

const renderSession = (
  session: WorkoutSession,
  history: WorkoutHistory,
  indent: string
): string[] => {
  const status = session.complete ? '✅' : '⏸️';
  const rsmTotal = WorkoutSessionService.getRsmTotal(session);
  const fatigueTotal = WorkoutSessionService.getFatigueTotal(session);
  const sfr = WorkoutSessionService.getSFR(session);

  const lines: string[] = [
    `${indent}💪 "${session.title}"  ${formatDateTime(session.startTime)}  ${status}${formatRsmFatigue(rsmTotal, fatigueTotal, sfr)}`
  ];

  const exerciseIndent = indent + PAD;
  if (session.sessionExerciseOrder.length === 0) {
    lines.push(`${exerciseIndent}(no exercises)`);
    return lines;
  }
  for (const seId of session.sessionExerciseOrder) {
    const se = history.sessionExerciseMap.get(seId);
    if (!se) continue;
    lines.push(...renderSessionExercise(se, history, exerciseIndent));
  }
  return lines;
};

const renderMicrocycle = (
  microcycle: WorkoutMicrocycle,
  history: WorkoutHistory,
  indent: string
): string[] => {
  const status = microcycle.completedDate ? '✅ completed' : '⏳ in-progress';
  const lines: string[] = [
    `${indent}📅 MC  ${formatDate(microcycle.startDate)} → ${formatDate(microcycle.endDate)}  ${status}`
  ];

  const sessionIndent = indent + PAD;
  const sessionsForMc = history.sessionsByMicrocycleId.get(microcycle._id) ?? [];
  // Prefer the microcycle's canonical session order, then fall back to any
  // sessions not referenced in sessionOrder (defensive against stale orders).
  const orderedSessions: WorkoutSession[] = [];
  const seen = new Set<UUID>();
  for (const sessionId of microcycle.sessionOrder) {
    const session = sessionsForMc.find((s) => s._id === sessionId);
    if (session) {
      orderedSessions.push(session);
      seen.add(session._id);
    }
  }
  for (const session of sessionsForMc) {
    if (!seen.has(session._id)) orderedSessions.push(session);
  }

  if (orderedSessions.length === 0) {
    lines.push(`${sessionIndent}(no sessions)`);
    return lines;
  }
  for (const session of orderedSessions) {
    lines.push(...renderSession(session, history, sessionIndent));
  }
  return lines;
};

const renderMesocycle = (meso: WorkoutMesocycle, history: WorkoutHistory): string[] => {
  const microcycles = history.microcyclesByMesocycleId.get(meso._id) ?? [];
  const sortedMicrocycles = [...microcycles].sort(
    (a, b) => a.startDate.getTime() - b.startDate.getTime()
  );
  const projectedStart = WorkoutMesocycleService.getProjectedStartDate(meso, sortedMicrocycles);
  const projectedEnd = WorkoutMesocycleService.getProjectedEndDate(meso, sortedMicrocycles);

  let status: string;
  if (meso.completedDate != null) {
    status = '✅ completed';
  } else if (meso.startDate != null) {
    status = '🔥 active';
  } else {
    status = '📋 planned';
  }

  const title = meso.title ? `"${meso.title}"` : '(untitled)';
  const lines: string[] = [];
  lines.push(`🏋️ MESO  ${title}  type:${meso.cycleType}  ${status}`);
  lines.push(
    `${PAD}📅 dates: started=${formatDate(meso.startDate)}  completed=${formatDate(meso.completedDate)}`
  );
  lines.push(
    `${PAD}🔮 projected: ${formatDate(projectedStart)} → ${formatDate(projectedEnd)}  ` +
      `📐 plan: ${meso.plannedMicrocycleCount ?? '—'}mc × ${meso.plannedMicrocycleLengthInDays}d, ` +
      `${meso.plannedSessionCountPerMicrocycle} sess/mc`
  );
  if (meso.plannedMicrocycleRestDays.length > 0) {
    lines.push(`${PAD}🛌 rest day indices: [${meso.plannedMicrocycleRestDays.join(', ')}]`);
  }
  lines.push(`${PAD}🎚️ calibrated exercises: ${meso.calibratedExercises.length}`);

  if (sortedMicrocycles.length === 0) {
    lines.push(`${PAD}(no microcycles)`);
  } else {
    for (const mc of sortedMicrocycles) {
      lines.push('');
      lines.push(...renderMicrocycle(mc, history, PAD));
    }
  }
  return lines;
};

const renderHistory = (userId: UUID, history: WorkoutHistory): string => {
  const lines: string[] = [];
  const totalMicrocycles =
    history.orphanMicrocycles.length +
    [...history.microcyclesByMesocycleId.values()].reduce((acc, arr) => acc + arr.length, 0);
  const totalSessions =
    history.orphanSessions.length +
    [...history.sessionsByMicrocycleId.values()].reduce((acc, arr) => acc + arr.length, 0);

  lines.push(`🏋️ === Workout History — User: ${userId} ===`);
  lines.push(
    `📊 Counts: ${history.mesocycles.length} mesocycles | ${totalMicrocycles} microcycles | ` +
      `${totalSessions} sessions | ${history.sessionExerciseMap.size} session-exercises | ` +
      `${history.setMap.size} sets`
  );
  lines.push(
    `📚 Library: ${history.exerciseMap.size} exercises | ${history.equipmentMap.size} equipment types`
  );

  const sortedMesos = [...history.mesocycles].sort((a, b) => {
    const aMicros = history.microcyclesByMesocycleId.get(a._id) ?? [];
    const bMicros = history.microcyclesByMesocycleId.get(b._id) ?? [];
    const aStart = WorkoutMesocycleService.getProjectedStartDate(a, aMicros);
    const bStart = WorkoutMesocycleService.getProjectedStartDate(b, bMicros);
    const aTime = aStart?.getTime() ?? a.createdDate.getTime();
    const bTime = bStart?.getTime() ?? b.createdDate.getTime();
    return aTime - bTime;
  });

  for (const meso of sortedMesos) {
    lines.push('');
    lines.push('━'.repeat(72));
    lines.push(...renderMesocycle(meso, history));
  }

  if (history.orphanMicrocycles.length > 0) {
    lines.push('');
    lines.push('━'.repeat(72));
    lines.push('🆓 FREE-FORM MICROCYCLES (no mesocycle)');
    const sorted = [...history.orphanMicrocycles].sort(
      (a, b) => a.startDate.getTime() - b.startDate.getTime()
    );
    for (const mc of sorted) {
      lines.push('');
      lines.push(...renderMicrocycle(mc, history, PAD));
    }
  }

  if (history.orphanSessions.length > 0) {
    lines.push('');
    lines.push('━'.repeat(72));
    lines.push('🆓 FREE-FORM SESSIONS (no microcycle)');
    const sorted = [...history.orphanSessions].sort(
      (a, b) => a.startTime.getTime() - b.startTime.getTime()
    );
    for (const session of sorted) {
      lines.push('');
      lines.push(...renderSession(session, history, PAD));
    }
  }

  return lines.join('\n');
};

const main = async (): Promise<void> => {
  const userIdArg = process.argv[2];
  if (!userIdArg) {
    console.error('Usage: tsx ./scripts/getUserWorkoutHistory.ts <userId>');
    process.exit(1);
  }
  const userId = DocumentService.toUUID(userIdArg);
  try {
    const history = await fetchWorkoutHistory(userId);
    console.log(renderHistory(userId, history));
  } finally {
    await DocumentDb.closeDbConnection();
  }
};

void main().then(() => process.exit(0));
