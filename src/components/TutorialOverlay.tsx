import { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  useWindowDimensions, Animated, Easing,
} from 'react-native';
import { useTutorial } from '../contexts/TutorialContext';
import { useColors, Spacing, BorderRadius, FontSize } from '../constants/theme';
import { useLanguage } from '../contexts/LanguageContext';
import { TUTORIAL_STEPS } from '../data/tutorialSteps';

export default function TutorialOverlay() {
  const { isActive, currentStepIndex, totalSteps, nextStep, prevStep, exitTutorial } = useTutorial();
  const { width: W, height: H } = useWindowDimensions();
  const Colors = useColors();
  const { t } = useLanguage();

  // ── All animated values declared unconditionally ──────────────────────────
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const cardTranslateY = useRef(new Animated.Value(30)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  const step = TUTORIAL_STEPS[currentStepIndex] ?? TUTORIAL_STEPS[0];
  const hasSpotlight = !!step.spotlight;

  // Fade in / out overlay when active state or step changes
  useEffect(() => {
    if (!isActive) {
      Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start();
      return;
    }
    backdropOpacity.setValue(0);
    cardOpacity.setValue(0);
    cardTranslateY.setValue(30);

    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(cardOpacity, { toValue: 1, duration: 280, delay: 100, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(cardTranslateY, { toValue: 0, tension: 80, friction: 12, useNativeDriver: true }),
    ]).start();
  }, [isActive, currentStepIndex]);

  // Spotlight border pulse
  useEffect(() => {
    if (pulseLoop.current) { pulseLoop.current.stop(); pulseLoop.current = null; }
    if (!isActive || !hasSpotlight) { pulseAnim.setValue(0); return; }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 950, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 950, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    pulseLoop.current = loop;
    loop.start();
    return () => { loop.stop(); pulseLoop.current = null; };
  }, [isActive, currentStepIndex, hasSpotlight]);

  // ── Guard: render nothing when inactive ──────────────────────────────────
  if (!isActive) return null;

  const stepData = t.tutorial.steps[step.id as keyof typeof t.tutorial.steps];
  const title = stepData?.title ?? '';
  const description = stepData?.description ?? '';

  const isFirst = currentStepIndex === 0;
  const isLast = currentStepIndex === totalSteps - 1;

  // ── Spotlight geometry ─────────────────────────────────────────────────────
  const pad = 8;
  const sx = Math.max(0, W * (step.spotlight?.xStart ?? 0.04) - pad);
  const sy = Math.max(0, H * (step.spotlight?.yStart ?? 0) - pad);
  const sw = W * ((step.spotlight?.xEnd ?? 0.96) - (step.spotlight?.xStart ?? 0.04)) + pad * 2;
  const sh = H * ((step.spotlight?.yEnd ?? 0) - (step.spotlight?.yStart ?? 0)) + pad * 2;
  const sr = step.spotlight?.radius ?? 14;

  const spotlightBorderOpacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });

  // ── Tooltip card position ──────────────────────────────────────────────────
  const MARGIN = Spacing.lg;
  const tooltipPos = step.tooltipPosition;
  const cardPositionStyle =
    tooltipPos === 'center'  ? { top: H * 0.5 - 130, left: MARGIN, right: MARGIN } :
    tooltipPos === 'bottom'  ? { top: sy + sh + 16,   left: MARGIN, right: MARGIN } :
    /* top */                  { bottom: H - sy + 16,  left: MARGIN, right: MARGIN };

  // ── Progress dots ──────────────────────────────────────────────────────────
  const dots = Array.from({ length: totalSteps }, (_, i) => i);
  const isDark = Colors.background === '#000000';
  const cardBg = isDark ? '#1C1C1E' : '#FFFFFF';
  const titleColor = isDark ? '#FFFFFF' : '#1C1C1E';
  const descColor = isDark ? 'rgba(235,235,245,0.78)' : '#48484A';
  const secondaryBg = isDark ? '#2C2C2E' : '#F2F2F7';
  const secondaryText = isDark ? 'rgba(235,235,245,0.9)' : '#3A3A3C';

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* ── Dark mask with spotlight cutout ──────────────────────────────── */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: backdropOpacity }]} pointerEvents="auto">
        {hasSpotlight ? (
          <>
            {/* Top */}
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: sy, backgroundColor: 'rgba(0,0,0,0.78)' }} />
            {/* Bottom */}
            <View style={{ position: 'absolute', top: sy + sh, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.78)' }} />
            {/* Left */}
            <View style={{ position: 'absolute', top: sy, left: 0, width: sx, height: sh, backgroundColor: 'rgba(0,0,0,0.78)' }} />
            {/* Right */}
            <View style={{ position: 'absolute', top: sy, left: sx + sw, right: 0, height: sh, backgroundColor: 'rgba(0,0,0,0.78)' }} />
            {/* Transparent touch-blocker over spotlight hole */}
            <View style={{ position: 'absolute', top: sy, left: sx, width: sw, height: sh }} />
            {/* Animated spotlight border */}
            <Animated.View style={{
              position: 'absolute', top: sy, left: sx, width: sw, height: sh,
              borderRadius: sr, borderWidth: 2.5,
              borderColor: 'white', opacity: spotlightBorderOpacity,
            }} />
          </>
        ) : (
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.82)' }} />
        )}
      </Animated.View>

      {/* ── Tooltip card ─────────────────────────────────────────────────── */}
      <Animated.View
        style={[
          styles.card,
          { backgroundColor: cardBg },
          cardPositionStyle,
          { opacity: cardOpacity, transform: [{ translateY: cardTranslateY }] },
        ]}
        pointerEvents="auto"
      >
        {/* Progress dots */}
        <View style={styles.dotsRow}>
          {dots.map(i => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor:
                    i === currentStepIndex ? Colors.primary :
                    i < currentStepIndex   ? Colors.primary + '44' :
                    isDark ? '#3A3A3C' : '#D1D1D6',
                  width: i === currentStepIndex ? 18 : 6,
                },
              ]}
            />
          ))}
        </View>

        {/* Step counter */}
        <Text style={[styles.stepLabel, { color: Colors.textSecondary }]}>
          {t.tutorial.progressLabel(currentStepIndex + 1, totalSteps)}
        </Text>

        {/* Welcome / Done emoji */}
        {(isFirst || isLast) && (
          <Text style={styles.bigEmoji}>{isFirst ? '👋' : '🎉'}</Text>
        )}

        <Text style={[styles.title, { color: titleColor }]}>{title}</Text>
        <Text style={[styles.desc, { color: descColor }]}>{description}</Text>

        {/* Action buttons */}
        <View style={styles.btnRow}>
          <View style={styles.btnLeft}>
            {!isFirst && (
              <TouchableOpacity
                style={[styles.btnSecondary, { backgroundColor: secondaryBg }]}
                onPress={prevStep}
                activeOpacity={0.7}
              >
                <Text style={[styles.btnSecondaryText, { color: secondaryText }]}>{t.tutorial.back}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={exitTutorial} style={styles.skipBtn} activeOpacity={0.6}>
              <Text style={[styles.skipText, { color: Colors.textSecondary }]}>{t.tutorial.skip}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.btnPrimary, { backgroundColor: Colors.primary }]}
            onPress={isLast ? exitTutorial : nextStep}
            activeOpacity={0.8}
          >
            <Text style={styles.btnPrimaryText}>
              {isLast ? t.tutorial.finish : `${t.tutorial.next} →`}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    borderRadius: 20,
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 20,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  stepLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: Spacing.xs,
  },
  bigEmoji: {
    fontSize: 38,
    marginTop: 2,
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    marginBottom: Spacing.sm,
    lineHeight: 24,
  },
  desc: {
    fontSize: FontSize.md,
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  btnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  btnPrimary: {
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: BorderRadius.full,
  },
  btnPrimaryText: {
    color: '#fff',
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  btnSecondary: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 9,
    borderRadius: BorderRadius.full,
  },
  btnSecondaryText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  skipBtn: {
    paddingVertical: 9,
    paddingHorizontal: 4,
  },
  skipText: {
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
});
