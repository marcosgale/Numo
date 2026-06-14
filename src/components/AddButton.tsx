import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable } from 'react-native';
import { Plus, X, TrendingDown, TrendingUp, Users, RefreshCw } from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, FontSize } from '../constants/theme';

type AddButtonProps = {
  visible: boolean;
  onClose: () => void;
  onSelectOption: (option: 'expense' | 'income' | 'shared' | 'recurring') => void;
};

export default function AddButton({ visible, onClose, onSelectOption }: AddButtonProps) {
  const handleSelect = (option: 'expense' | 'income' | 'shared' | 'recurring') => {
    onClose();
    onSelectOption(option);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Añadir movimiento</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={24} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.grid}>
            <TouchableOpacity
              style={[styles.gridItem, { backgroundColor: '#FFE5E5' }]}
              onPress={() => handleSelect('expense')}
            >
              <View style={styles.iconCircle}>
                <TrendingDown size={28} color={Colors.negative} />
              </View>
              <Text style={styles.gridLabel}>Gasto</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.gridItem, { backgroundColor: '#E5F8EE' }]}
              onPress={() => handleSelect('income')}
            >
              <View style={styles.iconCircle}>
                <TrendingUp size={28} color={Colors.positive} />
              </View>
              <Text style={styles.gridLabel}>Ingreso</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.gridItem, { backgroundColor: '#F0E5FF' }]}
              onPress={() => handleSelect('shared')}
            >
              <View style={styles.iconCircle}>
                <Users size={28} color="#9B59B6" />
              </View>
              <Text style={styles.gridLabel}>Gasto compartido</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.gridItem, { backgroundColor: '#E5F0FF' }]}
              onPress={() => handleSelect('recurring')}
            >
              <View style={styles.iconCircle}>
                <RefreshCw size={28} color="#3498DB" />
              </View>
              <Text style={styles.gridLabel}>Gasto recurrente</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
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
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.7)',
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