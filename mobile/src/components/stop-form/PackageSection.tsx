import React from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { FormSectionProps } from './types';

interface PackageSectionProps extends FormSectionProps {
    packageCount: number;
    packageFinderId: string;
    durationMinutes: number;
    onPackageCountChange: (value: number) => void;
    onPackageFinderIdChange: (value: string) => void;
    onDurationMinutesChange: (value: number) => void;
}

export function PackageSection({
    colors,
    packageCount,
    packageFinderId,
    durationMinutes,
    onPackageCountChange,
    onPackageFinderIdChange,
    onDurationMinutesChange,
}: PackageSectionProps) {
    const textSecondary = colors.textSecondary;

    return (
        <View>
            <Text style={{ color: textSecondary, fontSize: 12, marginBottom: 6 }}>Chercheur de colis (ID)</Text>
            <TextInput
                value={packageFinderId}
                onChangeText={onPackageFinderIdChange}
                placeholder="Ex: ABC-123456"
                placeholderTextColor={textSecondary}
                autoCapitalize="characters"
                style={{
                    backgroundColor: colors.background,
                    borderRadius: 12,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    color: colors.textPrimary,
                    marginBottom: 12,
                }}
            />

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <Text style={{ color: textSecondary, fontSize: 12 }}>Nombre de colis</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <TouchableOpacity
                        onPress={() => onPackageCountChange(Math.max(0, packageCount - 1))}
                        style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}
                    >
                        <Text style={{ color: colors.textPrimary, fontWeight: '800', fontSize: 18 }}>-</Text>
                    </TouchableOpacity>
                    <Text style={{ color: colors.textPrimary, fontWeight: '800', minWidth: 24, textAlign: 'center' }}>{packageCount}</Text>
                    <TouchableOpacity
                        onPress={() => onPackageCountChange(packageCount + 1)}
                        style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}
                    >
                        <Text style={{ color: colors.textPrimary, fontWeight: '800', fontSize: 18 }}>+</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <Text style={{ color: textSecondary, fontSize: 12 }}>Durée d'arrêt estimée</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <TouchableOpacity
                        onPress={() => onDurationMinutesChange(Math.max(0, durationMinutes - 1))}
                        style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}
                    >
                        <Text style={{ color: colors.textPrimary, fontWeight: '800', fontSize: 18 }}>-</Text>
                    </TouchableOpacity>
                    <Text style={{ color: colors.textPrimary, fontWeight: '800', minWidth: 56, textAlign: 'center' }}>{durationMinutes} min</Text>
                    <TouchableOpacity
                        onPress={() => onDurationMinutesChange(durationMinutes + 1)}
                        style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}
                    >
                        <Text style={{ color: colors.textPrimary, fontWeight: '800', fontSize: 18 }}>+</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

export default PackageSection;
