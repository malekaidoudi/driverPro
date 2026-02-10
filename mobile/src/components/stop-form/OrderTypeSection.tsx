import React from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { StopType, StopPriority } from '../../types';
import { FormSectionProps, StopOrder } from './types';

interface OrderTypeSectionProps extends FormSectionProps {
    order: StopOrder;
    type: StopType;
    priority: StopPriority;
    timeWindowStart: string;
    timeWindowEnd: string;
    onOrderChange: (value: StopOrder) => void;
    onTypeChange: (value: StopType) => void;
    onPriorityChange: (value: StopPriority) => void;
    onTimeWindowStartChange: (value: string) => void;
    onTimeWindowEndChange: (value: string) => void;
}

export function OrderTypeSection({
    colors,
    order,
    type,
    priority,
    timeWindowStart,
    timeWindowEnd,
    onOrderChange,
    onTypeChange,
    onPriorityChange,
    onTimeWindowStartChange,
    onTimeWindowEndChange,
}: OrderTypeSectionProps) {
    const textSecondary = colors.textSecondary;

    return (
        <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <Text style={{ color: textSecondary, fontSize: 12 }}>Ordre</Text>
                <View style={{ flexDirection: 'row', backgroundColor: colors.background, borderRadius: 12, padding: 4 }}>
                    {([
                        { key: 'first' as const, label: 'Premier' },
                        { key: 'auto' as const, label: 'Auto' },
                        { key: 'last' as const, label: 'Dernier' },
                    ]).map((it) => (
                        <TouchableOpacity
                            key={it.key}
                            onPress={() => onOrderChange(it.key)}
                            style={{
                                paddingVertical: 8,
                                paddingHorizontal: 12,
                                borderRadius: 10,
                                backgroundColor: order === it.key ? colors.primary : 'transparent',
                            }}
                        >
                            <Text style={{ color: order === it.key ? '#FFFFFF' : colors.textPrimary, fontWeight: '800', fontSize: 12 }}>{it.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <Text style={{ color: textSecondary, fontSize: 12 }}>Type</Text>
                <View style={{ flexDirection: 'row', backgroundColor: colors.background, borderRadius: 12, padding: 4 }}>
                    <TouchableOpacity
                        onPress={() => onTypeChange(StopType.DELIVERY)}
                        style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: type === StopType.DELIVERY ? colors.primary : 'transparent' }}
                    >
                        <Text style={{ color: type === StopType.DELIVERY ? '#FFFFFF' : colors.textPrimary, fontWeight: '800', fontSize: 12 }}>Livraison</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => onTypeChange(StopType.COLLECTION)}
                        style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: type === StopType.COLLECTION ? colors.primary : 'transparent' }}
                    >
                        <Text style={{ color: type === StopType.COLLECTION ? '#FFFFFF' : colors.textPrimary, fontWeight: '800', fontSize: 12 }}>Collecte</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <Text style={{ color: textSecondary, fontSize: 12 }}>Priorité</Text>
                <View style={{ flexDirection: 'row', backgroundColor: colors.background, borderRadius: 12, padding: 4 }}>
                    {([
                        { key: StopPriority.NORMAL, label: '🟢', color: '#22C55E' },
                        { key: StopPriority.HIGH, label: '🟠', color: '#F59E0B' },
                        { key: StopPriority.URGENT, label: '🔴', color: '#EF4444' },
                    ] as const).map((it) => (
                        <TouchableOpacity
                            key={it.key}
                            onPress={() => onPriorityChange(it.key)}
                            style={{
                                paddingVertical: 8,
                                paddingHorizontal: 12,
                                borderRadius: 10,
                                backgroundColor: priority === it.key ? it.color : 'transparent',
                            }}
                        >
                            <Text style={{ color: priority === it.key ? '#FFFFFF' : colors.textPrimary, fontWeight: '800', fontSize: 14 }}>{it.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <View style={{ marginBottom: 12 }}>
                <Text style={{ color: textSecondary, fontSize: 12, marginBottom: 6 }}>Heure d'arrivée (optionnel)</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TextInput
                        value={timeWindowStart}
                        onChangeText={onTimeWindowStartChange}
                        placeholder="08:00"
                        placeholderTextColor={textSecondary}
                        keyboardType="numbers-and-punctuation"
                        style={{
                            flex: 1,
                            backgroundColor: colors.background,
                            borderRadius: 12,
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            color: colors.textPrimary,
                            textAlign: 'center',
                        }}
                    />
                    <Text style={{ color: textSecondary }}>→</Text>
                    <TextInput
                        value={timeWindowEnd}
                        onChangeText={onTimeWindowEndChange}
                        placeholder="12:00"
                        placeholderTextColor={textSecondary}
                        keyboardType="numbers-and-punctuation"
                        style={{
                            flex: 1,
                            backgroundColor: colors.background,
                            borderRadius: 12,
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            color: colors.textPrimary,
                            textAlign: 'center',
                        }}
                    />
                </View>
            </View>
        </View>
    );
}

export default OrderTypeSection;
