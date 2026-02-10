import React from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { MagnifyingGlass } from 'phosphor-react-native';
import { FormSectionProps, PackageLocation } from './types';

interface PackageSectionProps extends FormSectionProps {
    packageCount: number;
    packageFinderId: string;
    durationMinutes: number;
    packageLocation?: PackageLocation;
    onPackageCountChange: (value: number) => void;
    onPackageFinderIdChange: (value: string) => void;
    onDurationMinutesChange: (value: number) => void;
    onOpenPackageFinder?: () => void;
}

export function PackageSection({
    colors,
    packageCount,
    packageFinderId,
    durationMinutes,
    packageLocation,
    onPackageCountChange,
    onPackageFinderIdChange,
    onDurationMinutesChange,
    onOpenPackageFinder,
}: PackageSectionProps) {
    const textSecondary = colors.textSecondary;

    // Build location summary string
    const getLocationSummary = (): string | null => {
        if (!packageLocation) return null;
        const parts: string[] = [];
        if (packageLocation.size) {
            const sizeLabels = { small: 'Petit', medium: 'Moyen', large: 'Gros' };
            parts.push(sizeLabels[packageLocation.size]);
        }
        if (packageLocation.type) {
            const typeLabels = { box: 'Boîte', bag: 'Sac', letter: 'Lettre' };
            parts.push(typeLabels[packageLocation.type]);
        }
        if (packageLocation.depth) {
            const depthLabels = { front: 'Avant', middle: 'Milieu', back: 'Arrière' };
            parts.push(depthLabels[packageLocation.depth]);
        }
        if (packageLocation.side) {
            const sideLabels = { left: 'Gauche', right: 'Droite' };
            parts.push(sideLabels[packageLocation.side]);
        }
        if (packageLocation.level) {
            const levelLabels = { floor: 'Plancher', shelf: 'Étagère' };
            parts.push(levelLabels[packageLocation.level]);
        }
        return parts.length > 0 ? parts.join(' • ') : null;
    };

    const locationSummary = getLocationSummary();

    return (
        <View>
            {/* Package Finder Button */}
            <Text style={{ color: textSecondary, fontSize: 12, marginBottom: 6 }}>Chercheur de colis</Text>
            <TouchableOpacity
                onPress={onOpenPackageFinder}
                style={{
                    backgroundColor: colors.background,
                    borderRadius: 12,
                    paddingHorizontal: 12,
                    paddingVertical: 12,
                    marginBottom: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}
            >
                <View style={{ flex: 1 }}>
                    {locationSummary ? (
                        <Text style={{ color: colors.textPrimary, fontSize: 14 }} numberOfLines={1}>
                            {locationSummary}
                        </Text>
                    ) : (
                        <Text style={{ color: textSecondary, fontSize: 14 }}>
                            Appuyez pour localiser le colis
                        </Text>
                    )}
                </View>
                <MagnifyingGlass size={20} color={colors.primary} />
            </TouchableOpacity>

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
