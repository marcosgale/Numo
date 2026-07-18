import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { navigationRef } from '../navigation';
import { TUTORIAL_STEPS, TOTAL_STEPS } from '../data/tutorialSteps';

const PROGRESS_KEY = 'tutorial_step_progress';

type TutorialContextType = {
  isActive: boolean;
  currentStepIndex: number;
  totalSteps: number;
  startTutorial: (fromStep?: number) => Promise<void>;
  resumeOrStart: () => Promise<void>;
  nextStep: () => void;
  prevStep: () => void;
  exitTutorial: () => Promise<void>;
};

const TutorialContext = createContext<TutorialContextType | null>(null);

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const [isActive, setIsActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  // Track whether a navigation is in progress to avoid double navigation
  const navigating = useRef(false);

  const navigateToStep = useCallback(async (nextIndex: number, prevIndex: number) => {
    const step = TUTORIAL_STEPS[nextIndex];
    const prevStep = prevIndex >= 0 ? TUTORIAL_STEPS[prevIndex] : null;

    if (step.tab && step.tab !== prevStep?.tab) {
      if (navigating.current) return;
      navigating.current = true;
      try {
        navigationRef.navigate('MainTabs' as never, { screen: step.tab } as never);
        // Wait for the navigation animation to complete
        await new Promise(r => setTimeout(r, 500));
      } finally {
        navigating.current = false;
      }
    }
  }, []);

  const startTutorial = useCallback(async (fromStep = 0) => {
    const safeStep = Math.max(0, Math.min(fromStep, TOTAL_STEPS - 1));
    await navigateToStep(safeStep, -1);
    setCurrentStepIndex(safeStep);
    setIsActive(true);
    await AsyncStorage.setItem(PROGRESS_KEY, String(safeStep));
  }, [navigateToStep]);

  const resumeOrStart = useCallback(async () => {
    const saved = await AsyncStorage.getItem(PROGRESS_KEY);
    const savedStep = saved !== null ? parseInt(saved, 10) : 0;
    const fromStep = isNaN(savedStep) ? 0 : savedStep;
    await startTutorial(fromStep);
  }, [startTutorial]);

  const exitTutorial = useCallback(async () => {
    setIsActive(false);
    await AsyncStorage.removeItem(PROGRESS_KEY);
  }, []);

  const nextStep = useCallback(async () => {
    const next = currentStepIndex + 1;
    if (next >= TOTAL_STEPS) {
      await exitTutorial();
      return;
    }
    await navigateToStep(next, currentStepIndex);
    setCurrentStepIndex(next);
    AsyncStorage.setItem(PROGRESS_KEY, String(next));
  }, [currentStepIndex, navigateToStep, exitTutorial]);

  const prevStep = useCallback(async () => {
    if (currentStepIndex <= 0) return;
    const prev = currentStepIndex - 1;
    await navigateToStep(prev, currentStepIndex);
    setCurrentStepIndex(prev);
    AsyncStorage.setItem(PROGRESS_KEY, String(prev));
  }, [currentStepIndex, navigateToStep]);

  return (
    <TutorialContext.Provider value={{
      isActive,
      currentStepIndex,
      totalSteps: TOTAL_STEPS,
      startTutorial,
      resumeOrStart,
      nextStep,
      prevStep,
      exitTutorial,
    }}>
      {children}
    </TutorialContext.Provider>
  );
}

export function useTutorial() {
  const ctx = useContext(TutorialContext);
  if (!ctx) throw new Error('useTutorial must be used inside TutorialProvider');
  return ctx;
}
