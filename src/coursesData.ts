// ============================================================================
// СЛОНОЛОГИЯ.EDU — ТАКСОНОМИЯ, 51 АКАДЕМИЧЕСКИЙ МОДУЛЬ И СИМУЛЯТОРЫ
// ============================================================================

export type AcademicTrack =
  | 'TRACK_1_PHYSIOLOGY_AND_HINDGUT'
  | 'TRACK_2_SOIL_SCIENCE_AND_RHIZOSPHERE'
  | 'TRACK_3_LAB_PROTOCOLS_AND_BIOCHEM'
  | 'TRACK_4_CIRCULAR_ECONOMY_AND_HEC';

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  scientificCitation: string;
}

export interface CaseStudy {
  id: string;
  title: string;
  initialParameters: Record<string, number | string>;
  scenarioPrompt: string;
  expectedDecisions: {
    decisionKey: string;
    targetValue: number | string;
    tolerance?: number;
    errorFeedback: string;
  }[];
}

export interface LessonNode {
  id: string;
  title: string;
  theoryMarkdown: string;
  quizzes: QuizQuestion[];
  caseStudy?: CaseStudy;
}

export interface CourseModule {
  id: string;
  moduleIndex: number; // 1 to 51
  track: AcademicTrack;
  title: string;
  scientificContext: string;
  requiredReadings: string[];
  lessons: LessonNode[];
}

export interface CompostingSimulationState {
  day: number; // 1 - 90
  currentTemperatureC: number;
  moisturePercentage: number; // Оптимум: 50 - 65%
  pileVolumeCubicMeters: number;
  cnRatio: number;
  aerationTurnCount: number;
  lastTurnDay: number;
  thermophilicDaysAccumulated: number;
  isAnaerobicRotting: boolean;
  pathogenDevitalizationPercent: {
    fasciolaJacksoniEggs: number; // Требует >= 55°C не менее 14 дней
    weedSeedsScarified: number;   // Требует >= 60°C не менее 7 дней
    clostridiumSporeTiterLogReduction: number;
  };
  odorVfaIndex: number; // Летучие жирные кислоты (ацетат/бутират), 0 - 100
  vermicompostingReady: boolean;
}

export interface CompostingActionPayload {
  action: 'TURN_PILE' | 'ADD_WATER' | 'ADD_NITROGEN_UREA' | 'ADD_BULKING_STRAW' | 'REST_DAY';
  amount?: number;
}

export interface PaperDelignificationState {
  rawFiberInputGrams: number;
  liquorRatio: number; // Гидромодуль (отношение сырья к воде), оптимум 1:8 - 1:10
  naohConcentrationPercent: number; // Оптимум 1.0 - 3.0%
  cookingTemperatureC: number; // Оптимум 98 - 102 °C
  cookingTimeMinutes: number; // Оптимум 240 - 360 мин (4 - 6 часов)
  bananaPseudoStemRatio: number; // Доля волокон банана (со-волокна), оптимум 0.35 - 0.45

  // Рассчитываемые параметры на выходе
  ligninRemovalPercent: number;
  celluloseYieldGrams: number;
  fiberDamageAlphaLossPercent: number;
  residualOdorIndex: number;
  sheetTensileStrengthMPa: number;
}

export const ACADEMIC_TRACK_LABELS: Record<AcademicTrack, { code: string; title: string; range: string }> = {
  TRACK_1_PHYSIOLOGY_AND_HINDGUT: {
    code: 'ТРЕК I',
    title: 'Физиология и трофика Hindgut Fermenters',
    range: 'Модули 01–13'
  },
  TRACK_2_SOIL_SCIENCE_AND_RHIZOSPHERE: {
    code: 'ТРЕК II',
    title: 'Почвоведение, гидрология и микробиом ризосферы',
    range: 'Модули 14–26'
  },
  TRACK_3_LAB_PROTOCOLS_AND_BIOCHEM: {
    code: 'ТРЕК III',
    title: 'Лабораторные протоколы переработки и биобезопасность',
    range: 'Модули 27–39'
  },
  TRACK_4_CIRCULAR_ECONOMY_AND_HEC: {
    code: 'ТРЕК IV',
    title: 'Циркулярная экономика, CITES и митигация HEC',
    range: 'Модули 40–51'
  }
};

/**
 * Полный верифицированный корпус из 51 уникального модуля (лекции, источники,
 * аттестационные задания) синхронизирован в корневом модуле `modules-data.js`
 * (`window.SLONOLOGIA_51_MODULES`) и проверен юнит-тестами `tests/lab.test.ts`.
 */
export const SLONOLOGIA_TOTAL_MODULES = 51 as const;

