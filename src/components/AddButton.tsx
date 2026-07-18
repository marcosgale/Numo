import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, Pressable,
  Animated, Easing
} from 'react-native';
import { X, TrendingDown, TrendingUp, Users, RefreshCw } from 'lucide-react-native';
import { useColors, Spacing, BorderRadius, FontSize } from '../constants/theme';
import { useLanguage } from '../contexts/LanguageContext';

type AddButtonProps = {
  visible: boolean;
  onClose: () => void;
  onSelectOption: (option: 'expense' | 'income' | 'shared' | 'recurring') => void;
};

export default function AddButton({ visible, onClose, onSelectOption }: AddButtonProps) {
  const Colors = useColors();
  const { t } = useLanguage();
  const isDark = Colors.background === '#000000';

  const [internalVisible, setInternalVisible] = useState(false);

  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(420)).current;
  const itemAnims = useRef(
    Array.from({ length: 4 }, () => ({
      opacity: new Animated.Value(0),
      scale: new Animated.Value(0.85),
    }))
  ).current;

  useEffect(() => {
    if (visible) {
      backdropOpacity.setValue(0);
      sheetTranslateY.setValue(420);
      itemAnims.forEach(({ opacity, scale }) => {
        opacity.setValue(0);
        scale.setValue(0.85);
      });
      setInternalVisible(true);

      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(sheetTranslateY, {
          toValue: 0,
          tension: 65,
          friction: 11,
          useNativeDriver: true,
        }),
        Animated.stagger(
          70,
          itemAnims.map(({ opacity, scale }) =>
            Animated.parallel([
              Animated.spring(opacity, { toValue: 1, tension: 80, friction: 10, useNativeDriver: true }),
              Animated.spring(scale, { toValue: 1, tension: 80, friction: 10, useNativeDriver: true }),
            ])
          )
        ),
      ]).start();
    }
  }, [visible]);

  const animateClose = (callback: () => void) => {
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslateY, {
        toValue: 420,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setInternalVisible(false);
      callback();
    });
  };

  const handleClose = () => animateClose(onClose);

  const handleSelect = (option: 'expense' | 'income' | 'shared' | 'recurring') => {
    animateClose(() => {
      onClose();
      onSelectOption(option);
    });
  };

  const OPTIONS = [
    {
      key: 'expense' as const,
      Icon: TrendingDown,
      color: Colors.negative,
      bg: isDark ? '#3A1212' : '#FFE5E5',
      label: t.addButton.expense,
    },
    {
      key: 'income' as const,
      Icon: TrendingUp,
      color: Colors.positive,
      bg: isDark ? '#0A2A15' : '#E5F8EE',
      label: t.addButton.income,
    },
    {
      key: 'shared' as const,
      Icon: Users,
      color: '#9B59B6',
      bg: isDark ? '#1E0A2A' : '#F0E5FF',
      label: t.addButton.shared,
    },
    {
      key: 'recurring' as const,
      Icon: RefreshCw,
      color: '#3498DB',
      bg: isDark ? '#0A1A2A' : '#E5F0FF',
      label: t.addButton.recurring,
    },
  ];

  const styles = makeStyles(Colors);

  return (
    <Modal
      visible={internalVisible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        </Animated.View>

        <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetTranslateY }] }]}>
          <View style={styles.handle} />

          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{t.addButton.title}</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <X size={24} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.grid}>
            {OPTIONS.map(({ key, Icon, color, bg, label }, index) => (
              <Animated.View
                key={key}
                style={[
                  styles.gridItem,
                  { backgroundColor: bg },
                  {
                    opacity: itemAnims[index].opacity,
                    transform: [{ scale: itemAnims[index].scale }],
                  },
                ]}
              >
                <TouchableOpacity
                  style={styles.gridItemInner}
                  onPress={() => handleSelect(key)}
                  activeOpacity={0.72}
                >
                  <View style={styles.iconCircle}>
                    <Icon size={28} color={color} />
                  </View>
                  <Text style={styles.gridLabel}>{label}</Text>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const makeStyles = (Colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.52)',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.lg,
    paddingBottom: 40,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  sheetTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  gridItem: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  gridItemInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(128,128,128,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  gridLabel: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
});
