import React, { useCallback, useMemo, forwardRef, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import { Truck, Package, Tray, CaretLeft, CaretRight } from 'phosphor-react-native';
import * as Haptics from 'expo-haptics';
import { FormSectionProps, PackageLocation, PackageSize, PackageType, VehiclePositionDepth, VehiclePositionSide, VehiclePositionLevel } from './types';

interface PackageFinderSheetProps extends FormSectionProps {
    stopId?: string;
    initialLocation?: PackageLocation;
    onSave: (location: PackageLocation) => void;
    onClear: () => void;
}

const PackageFinderSheet = forwardRef<BottomSheet, PackageFinderSheetProps>(
    ({ colors, stopId, initialLocation, onSave, onClear }, ref) => {
        const snapPoints = useMemo(() => ['85%'], []);
        const textSecondary = colors.textSecondary;

        // Local state
        const [size, setSize] = useState<PackageSize | undefined>(initialLocation?.size);
        const [type, setType] = useState<PackageType | undefined>(initialLocation?.type);
        const [depth, setDepth] = useState<VehiclePositionDepth | undefined>(initialLocation?.depth);
        const [side, setSide] = useState<VehiclePositionSide | undefined>(initialLocation?.side);
        const [level, setLevel] = useState<VehiclePositionLevel | undefined>(initialLocation?.level);

        // Sync with initial location when it changes
        useEffect(() => {
            setSize(initialLocation?.size);
            setType(initialLocation?.type);
            setDepth(initialLocation?.depth);
            setSide(initialLocation?.side);
            setLevel(initialLocation?.level);
        }, [initialLocation]);

        const renderBackdrop = useCallback(
            (props: any) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.6} />,
            []
        );

        const handleClear = useCallback(() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setSize(undefined);
            setType(undefined);
            setDepth(undefined);
            setSide(undefined);
            setLevel(undefined);
            onClear();
            (ref as React.RefObject<BottomSheet>)?.current?.close();
        }, [onClear, ref]);

        const handleSave = useCallback(() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            const location: PackageLocation = {
                size,
                type,
                depth,
                side,
                level,
            };
            onSave(location);
            (ref as React.RefObject<BottomSheet>)?.current?.close();
        }, [size, type, depth, side, level, onSave, ref]);

        const handleSelect = useCallback((setter: React.Dispatch<React.SetStateAction<any>>, value: any) => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setter(value);
        }, []);

        // Option button component
        const OptionButton = ({
            label,
            selected,
            onPress,
            icon,
            flex = 1
        }: {
            label: string;
            selected: boolean;
            onPress: () => void;
            icon?: React.ReactNode;
            flex?: number;
        }) => (
            <TouchableOpacity
                onPress={onPress}
                style={[
                    styles.optionButton,
                    {
                        backgroundColor: colors.surface,
                        borderColor: selected ? colors.primary : colors.border,
                        borderWidth: selected ? 2 : 1,
                        flex,
                    }
                ]}
            >
                {icon && <View style={{ marginRight: 6 }}>{icon}</View>}
                <Text style={{
                    color: selected ? colors.primary : colors.textPrimary,
                    fontWeight: selected ? '700' : '500',
                    fontSize: 14,
                }}>
                    {label}
                </Text>
            </TouchableOpacity>
        );

        return (
            <BottomSheet
                ref={ref}
                index={-1}
                snapPoints={snapPoints}
                enablePanDownToClose
                backdropComponent={renderBackdrop}
                backgroundStyle={{ backgroundColor: colors.background }}
                handleIndicatorStyle={{ backgroundColor: colors.textSecondary }}
            >
                <BottomSheetView style={[styles.container, { backgroundColor: colors.background }]}>
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={handleClear}>
                            <Text style={{ color: colors.textPrimary, fontSize: 16 }}>Effacer</Text>
                        </TouchableOpacity>
                        <Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: '600' }}>
                            Chercheur de colis
                        </Text>
                        <TouchableOpacity onPress={handleSave}>
                            <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '600' }}>Terminé</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Stop ID */}
                    <View style={styles.section}>
                        <Text style={[styles.label, { color: textSecondary }]}>ID d'arrêt</Text>
                        <View style={[styles.idBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            <Text style={{ color: colors.primary, fontWeight: '600', marginRight: 4 }}>ID</Text>
                            <Text style={{ color: colors.textPrimary, fontWeight: '500' }}>
                                {stopId || 'En attente'}
                            </Text>
                        </View>
                    </View>

                    {/* Package Description */}
                    <View style={styles.section}>
                        <Text style={[styles.label, { color: textSecondary }]}>Description du colis</Text>

                        {/* Size */}
                        <View style={styles.optionRow}>
                            <OptionButton
                                label="Petit"
                                selected={size === 'small'}
                                onPress={() => handleSelect(setSize, 'small')}
                            />
                            <OptionButton
                                label="Moyen"
                                selected={size === 'medium'}
                                onPress={() => handleSelect(setSize, 'medium')}
                            />
                            <OptionButton
                                label="Gros"
                                selected={size === 'large'}
                                onPress={() => handleSelect(setSize, 'large')}
                            />
                        </View>

                        {/* Type */}
                        <View style={styles.optionRow}>
                            <OptionButton
                                label="Boîte"
                                selected={type === 'box'}
                                onPress={() => handleSelect(setType, 'box')}
                                icon={<Package size={18} color={type === 'box' ? colors.primary : colors.textPrimary} />}
                            />
                            <OptionButton
                                label="Sac"
                                selected={type === 'bag'}
                                onPress={() => handleSelect(setType, 'bag')}
                            />
                            <OptionButton
                                label="Lettre"
                                selected={type === 'letter'}
                                onPress={() => handleSelect(setType, 'letter')}
                            />
                        </View>
                    </View>

                    {/* Vehicle Position */}
                    <View style={styles.section}>
                        <Text style={[styles.label, { color: textSecondary }]}>Emplacement dans le véhicule</Text>

                        {/* Depth: Front/Middle/Back */}
                        <View style={styles.optionRow}>
                            <OptionButton
                                label="Avant"
                                selected={depth === 'front'}
                                onPress={() => handleSelect(setDepth, 'front')}
                                icon={<Truck size={18} color={depth === 'front' ? colors.primary : colors.textPrimary} />}
                            />
                            <OptionButton
                                label="Milieu"
                                selected={depth === 'middle'}
                                onPress={() => handleSelect(setDepth, 'middle')}
                                icon={<Truck size={18} color={depth === 'middle' ? colors.primary : colors.textPrimary} />}
                            />
                            <OptionButton
                                label="Arrière"
                                selected={depth === 'back'}
                                onPress={() => handleSelect(setDepth, 'back')}
                                icon={<Truck size={18} color={depth === 'back' ? colors.primary : colors.textPrimary} />}
                            />
                        </View>

                        {/* Side: Left/Right */}
                        <View style={styles.optionRow}>
                            <OptionButton
                                label="Gauche"
                                selected={side === 'left'}
                                onPress={() => handleSelect(setSide, 'left')}
                                icon={<CaretLeft size={18} color={side === 'left' ? colors.primary : colors.textPrimary} />}
                            />
                            <OptionButton
                                label="Droite"
                                selected={side === 'right'}
                                onPress={() => handleSelect(setSide, 'right')}
                                icon={<CaretRight size={18} color={side === 'right' ? colors.primary : colors.textPrimary} />}
                            />
                        </View>

                        {/* Level: Floor/Shelf */}
                        <View style={styles.optionRow}>
                            <OptionButton
                                label="Plancher"
                                selected={level === 'floor'}
                                onPress={() => handleSelect(setLevel, 'floor')}
                                icon={<Tray size={18} color={level === 'floor' ? colors.primary : colors.textPrimary} />}
                            />
                            <OptionButton
                                label="Étagère"
                                selected={level === 'shelf'}
                                onPress={() => handleSelect(setLevel, 'shelf')}
                                icon={<Tray size={18} color={level === 'shelf' ? colors.primary : colors.textPrimary} weight="fill" />}
                            />
                        </View>
                    </View>
                </BottomSheetView>
            </BottomSheet>
        );
    }
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        marginBottom: 16,
    },
    section: {
        marginBottom: 20,
    },
    label: {
        fontSize: 13,
        marginBottom: 10,
    },
    idBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-end',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
    },
    optionRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 8,
    },
    optionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderRadius: 12,
    },
});

export default PackageFinderSheet;
