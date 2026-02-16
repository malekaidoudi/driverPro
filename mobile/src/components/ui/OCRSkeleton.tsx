/**
 * OCRSkeleton - Composant UX "Champs Fantômes"
 * 
 * Affiche des placeholders animés pendant le scan OCR:
 * - 0-200ms: Icônes avec scintillement
 * - 200-800ms: Adresse brute apparaît
 * - +800ms: Données nettoyées par spaCy
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { MapPin, User, Phone, Buildings } from 'phosphor-react-native';
import { useTheme } from '../../contexts/ThemeContext';

interface OCRSkeletonProps {
  /** Phase actuelle: idle, scanning, validating, validated, error */
  phase: 'idle' | 'scanning' | 'validating' | 'validated' | 'error';
  /** Données partielles (local parsing) */
  localData?: {
    street?: string;
    postalCode?: string;
    city?: string;
    phone?: string;
    name?: string;
    company?: string;
  };
  /** Données validées (backend spaCy) */
  validatedData?: {
    street?: string;
    postalCode?: string;
    city?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
    company?: string;
  };
}

export function OCRSkeleton({ phase, localData, validatedData }: OCRSkeletonProps) {
  const { colors } = useTheme();
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  // Animation de scintillement
  useEffect(() => {
    if (phase === 'scanning' || phase === 'validating') {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.ease,
            useNativeDriver: true,
          }),
          Animated.timing(shimmerAnim, {
            toValue: 0,
            duration: 800,
            easing: Easing.ease,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    }
  }, [phase, shimmerAnim]);

  const shimmerOpacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  // Sélectionner les données à afficher
  const data = validatedData || localData;
  const isValidated = phase === 'validated';
  const isLoading = phase === 'scanning' || phase === 'validating';

  const renderField = (
    icon: React.ReactNode,
    value: string | undefined,
    placeholder: string,
    isHighPriority: boolean = false
  ) => {
    const hasValue = !!value && value.trim() !== '';

    return (
      <View style={styles.fieldRow}>
        <View style={[styles.iconContainer, { backgroundColor: colors.bgSecondary }]}>
          {icon}
        </View>

        {hasValue ? (
          <Text
            style={[
              styles.fieldValue,
              { color: colors.textPrimary },
              isValidated && styles.fieldValidated
            ]}
            numberOfLines={1}
          >
            {value}
          </Text>
        ) : isLoading ? (
          <Animated.View
            style={[
              styles.skeleton,
              {
                backgroundColor: colors.bgSecondary,
                opacity: isHighPriority ? 1 : shimmerOpacity,
                width: isHighPriority ? '40%' : '60%',
              }
            ]}
          />
        ) : (
          <Text style={[styles.placeholder, { color: colors.textSecondary }]}>
            {placeholder}
          </Text>
        )}

        {isValidated && hasValue && (
          <View style={[styles.validatedBadge, { backgroundColor: colors.success }]}>
            <Text style={styles.validatedText}>✓</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      {/* Adresse - Priorité haute (apparaît en premier) */}
      {renderField(
        <MapPin size={20} color={colors.primary} weight="fill" />,
        data?.street ? `${data.street}` : undefined,
        'Adresse...',
        true
      )}

      {/* Ville + CP */}
      {renderField(
        <Buildings size={20} color={colors.primary} weight="fill" />,
        data?.postalCode && data?.city
          ? `${data.postalCode} ${data.city}`
          : data?.city || data?.postalCode,
        'Ville...',
        true
      )}

      {/* Téléphone - Apparaît rapidement (regex simple) */}
      {renderField(
        <Phone size={20} color={colors.primary} weight="fill" />,
        data?.phone,
        'Téléphone...',
        true
      )}

      {/* Nom - Apparaît après spaCy NER */}
      {renderField(
        <User size={20} color={colors.primary} weight="fill" />,
        validatedData?.firstName && validatedData?.lastName
          ? `${validatedData.firstName} ${validatedData.lastName}`
          : localData?.name,
        'Destinataire...',
        false
      )}

      {/* Entreprise - Apparaît après spaCy NER */}
      {(data?.company || isLoading) && renderField(
        <Buildings size={20} color={colors.textSecondary} weight="regular" />,
        data?.company,
        'Entreprise...',
        false
      )}

      {/* Status indicator */}
      <View style={styles.statusContainer}>
        {phase === 'scanning' && (
          <Text style={[styles.statusText, { color: colors.warning }]}>
            📷 Scan en cours...
          </Text>
        )}
        {phase === 'validating' && (
          <Text style={[styles.statusText, { color: colors.primary }]}>
            🔍 Validation spaCy + Google Maps...
          </Text>
        )}
        {phase === 'validated' && (
          <Text style={[styles.statusText, { color: colors.success }]}>
            ✅ Adresse validée
          </Text>
        )}
        {phase === 'error' && (
          <Text style={[styles.statusText, { color: colors.danger }]}>
            ⚠️ Erreur de validation
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fieldValue: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  fieldValidated: {
    fontWeight: '600',
  },
  placeholder: {
    flex: 1,
    fontSize: 14,
    fontStyle: 'italic',
  },
  skeleton: {
    height: 16,
    borderRadius: 4,
  },
  validatedBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  validatedText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  statusContainer: {
    marginTop: 8,
    alignItems: 'center',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '500',
  },
});

export default OCRSkeleton;
