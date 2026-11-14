// ============================================================================
// СЛОНОЛОГИЯ.EDU — ПРОГРЕСС ПОЛЬЗОВАТЕЛЯ, РАНГИ И ПРЕДИКАТЫ АЧИВОК
// ============================================================================

import {
  CompostingSimulationState,
  PaperDelignificationState
} from './coursesData';

export interface ModuleStatus {
  moduleId: string;
  isUnlocked: boolean;
  isCompleted: boolean;
  score: number; // 0 - 100%
  completedAt?: string;
  timeSpentSeconds: number;
}

export interface EarnedBadge {
  badgeId: string;
  unlockedAt: string;
  transactionHash?: string;
}

export interface UserProgress {
  userId: string;
  academicRankCode: string;
  totalXp: number;
  streakDays: number;
  modules: Record<string, ModuleStatus>;
  badges: EarnedBadge[];
  simulatorHighScores: {
    compostingCompletions: number;
    paperCraftYieldGrams: number;
  };
}

export interface AcademicTier {
  tierLevel: number;
  code: string;
  title: string;
  xpThreshold: number;
  perks: string[];
}

export const ACADEMIC_TIERS: AcademicTier[] = [
  {
    tierLevel: 1,
    code: 'TIER_LABORANT',
    title: 'Младший лаборант подиатрических наблюдений',
    xpThreshold: 0,
    perks: ['Доступ к базовым лекциям Трека 1']
  },
  {
    tierLevel: 2,
    code: 'TIER_ASSISTANT',
    title: 'Ассистент кафедры ветеринарной неонатологии',
    xpThreshold: 1200,
    perks: ['Доступ к симулятору термофильного бурта']
  },
  {
    tierLevel: 3,
    code: 'TIER_DOCENT',
    title: 'Доцент молекулярной палеобиохимии',
    xpThreshold: 4500,
    perks: ['Доступ к калькулятору щелочной делигнификации']
  },
  {
    tierLevel: 4,
    code: 'TIER_PROFESSOR',
    title: 'Профессор метапопуляционной инженерии',
    xpThreshold: 9000,
    perks: ['Доступ к расширенным кейс-стади']
  },
  {
    tierLevel: 5,
    code: 'TIER_ACADEMICIAN',
    title: 'Академик Высшего Совета Элефантологии',
    xpThreshold: 16000,
    perks: ['Статус эксперта-верификатора базы знаний']
  }
];

export interface AchievementDefinition {
  id: string;
  name: string;
  category: 'BIOCHEM' | 'COMPOST' | 'CIRCULAR' | 'PAPER' | 'GENETICS' | 'FIELD';
  description: string;
  xpReward: number;
  isUnlocked: (progress: UserProgress, simContext?: any) => boolean;
}

export const ACADEMIC_ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: 'ach-biochem-systematic',
    name: 'Биохимик-систематик',
    category: 'BIOCHEM',
    description: 'Безупречно пройден модуль по микробиому задней кишки (Hindgut Fermentation) и балансу ЛЖК.',
    xpReward: 350,
    isUnlocked: (progress) => {
      const hindgutModule = progress.modules['mod-1-hindgut-biomechanics'];
      return !!hindgutModule && hindgutModule.isCompleted && hindgutModule.score >= 95;
    }
  },
  {
    id: 'ach-compost-master',
    name: 'Мастер термофильного бурта',
    category: 'COMPOST',
    description: 'Успешно проведена санация бурта в симуляторе: >=14 суток в диапазоне 55-65°C без закисания.',
    xpReward: 500,
    isUnlocked: (_, simContext: CompostingSimulationState) => {
      return (
        !!simContext &&
        simContext.pathogenDevitalizationPercent.fasciolaJacksoniEggs === 100 &&
        !simContext.isAnaerobicRotting &&
        simContext.odorVfaIndex <= 2 &&
        simContext.cnRatio >= 14 &&
        simContext.cnRatio <= 18
      );
    }
  },
  {
    id: 'ach-circular-engineer',
    name: 'Инженер замкнутого цикла',
    category: 'CIRCULAR',
    description: 'Рассчитан нулевой баланс отходов в митигации HEC: интеграция навоза в ремесло и доходы фермеров.',
    xpReward: 450,
    isUnlocked: (progress) => {
      const hecModule = progress.modules['mod-9-46-human-elephant-conflict-mitigation'];
      return !!hecModule && hecModule.isCompleted && progress.simulatorHighScores.compostingCompletions >= 3;
    }
  },
  {
    id: 'ach-paper-craftsman',
    name: 'Эксперт по эко-бумаге',
    category: 'PAPER',
    description: 'В симуляторе делигнификации получено полотно прочностью >= 28 МПа с нулевым запахом (VFA <= 0.5).',
    xpReward: 500,
    isUnlocked: (_, simContext: PaperDelignificationState) => {
      return (
        !!simContext &&
        simContext.residualOdorIndex <= 0.5 &&
        simContext.sheetTensileStrengthMPa >= 28 &&
        simContext.ligninRemovalPercent >= 70 &&
        simContext.fiberDamageAlphaLossPercent <= 8
      );
    }
  },
  {
    id: 'ach-cn-guardian',
    name: 'Балансировщик азота',
    category: 'BIOCHEM',
    description: 'Безошибочный расчет дозировки мочевины для предотвращения азотной иммобилизации субстрата сухого сезона.',
    xpReward: 400,
    isUnlocked: (progress) => {
      const soilModule = progress.modules['mod-2-soil-microbiome-rhizosphere'];
      return !!soilModule && soilModule.isCompleted && soilModule.score === 100;
    }
  },
  {
    id: 'ach-hydro-master',
    name: 'Гидрологический мелиорант',
    category: 'COMPOST',
    description: 'Точный расчет снижения эвапотранспирации почвы на 65%+ с помощью пористой слоновьей мульчи.',
    xpReward: 300,
    isUnlocked: (progress) => {
      return !!progress.modules['mod-2-soil-water-holding-capacity']?.isCompleted;
    }
  },
  {
    id: 'ach-cites-auditor',
    name: 'Санитарный инспектор CITES',
    category: 'FIELD',
    description: 'Безупречное определение и инактивация спор Bacillus anthracis и вирусных патогенов в субстрате.',
    xpReward: 600,
    isUnlocked: (progress) => {
      const citesModule = progress.modules['mod-9-47-cites-mike-and-anti-poaching-monitoring'];
      return !!citesModule && citesModule.isCompleted && citesModule.score >= 90;
    }
  },
  {
    id: 'ach-zero-waste-sovereign',
    name: 'Академик нулевого следа',
    category: 'CIRCULAR',
    description: 'Полное завершение всех 51 модулей курса Слонология.EDU с рейтингом точности тестов выше 92%.',
    xpReward: 1500,
    isUnlocked: (progress) => {
      const totalModules = Object.values(progress.modules);
      if (totalModules.length < 51) return false;
      const allCompleted = totalModules.every((m) => m.isCompleted);
      const avgScore = totalModules.reduce((acc, m) => acc + m.score, 0) / totalModules.length;
      return allCompleted && avgScore >= 92;
    }
  }
];
