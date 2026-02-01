import 'react-native-gesture-handler';

import { useMemo, useRef, useState } from 'react';
import { SafeAreaView, Text, TouchableOpacity, View } from 'react-native';
import BottomSheet, { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';

export default function BottomSheetTestScreen() {
    const snapPoints = useMemo(() => [300], []);

    const [mode, setMode] = useState<'inline' | 'modal'>('inline');
    const [inlineIndex, setInlineIndex] = useState(0);

    const modalRef = useRef<BottomSheetModal | null>(null);

    const toggleInline = () => {
        setInlineIndex((prev) => (prev === -1 ? 0 : -1));
    };

    const presentModal = () => {
        modalRef.current?.present();
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
            <View style={{ padding: 16, gap: 12 }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>BottomSheet Test</Text>
                <Text style={{ fontSize: 13, color: '#6B7280' }}>
                    Objectif: vérifier si @gorhom/bottom-sheet rend quelque chose sur iPhone (Expo 54 / RN 0.81 / Reanimated 4).
                </Text>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                    <TouchableOpacity
                        onPress={() => setMode('inline')}
                        style={{
                            paddingVertical: 10,
                            paddingHorizontal: 12,
                            borderRadius: 10,
                            backgroundColor: mode === 'inline' ? '#111827' : '#E5E7EB',
                        }}
                    >
                        <Text style={{ color: mode === 'inline' ? '#FFFFFF' : '#111827', fontWeight: '700' }}>Inline</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setMode('modal')}
                        style={{
                            paddingVertical: 10,
                            paddingHorizontal: 12,
                            borderRadius: 10,
                            backgroundColor: mode === 'modal' ? '#111827' : '#E5E7EB',
                        }}
                    >
                        <Text style={{ color: mode === 'modal' ? '#FFFFFF' : '#111827', fontWeight: '700' }}>Modal</Text>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity
                    onPress={() => {
                        if (mode === 'inline') toggleInline();
                        else presentModal();
                    }}
                    style={{
                        paddingVertical: 12,
                        paddingHorizontal: 14,
                        borderRadius: 12,
                        backgroundColor: '#2563EB',
                        alignItems: 'center',
                    }}
                >
                    <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>{mode === 'inline' ? 'Toggle Inline' : 'Present Modal'}</Text>
                </TouchableOpacity>

                <Text style={{ fontSize: 12, color: '#6B7280' }}>
                    Attendu: en Inline, une sheet apparaît (index=0). En Modal, present() affiche la sheet.
                </Text>
            </View>

            <View
                style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 140,
                    backgroundColor: 'red',
                    opacity: 0.2,
                    zIndex: 9998,
                }}
                pointerEvents="none"
            />

            {mode === 'inline' ? (
                <BottomSheet
                    index={inlineIndex}
                    snapPoints={snapPoints}
                    enablePanDownToClose
                    onAnimate={(fromIndex, toIndex) => console.log('[BSTest] inline animate', { fromIndex, toIndex })}
                    onChange={(index, position, type) => console.log('[BSTest] inline change', { index, position, type })}
                    backgroundStyle={{ backgroundColor: '#F3F4F6' }}
                    handleIndicatorStyle={{ backgroundColor: '#6B7280' }}
                >
                    <BottomSheetView style={{ flex: 1, padding: 16 }}>
                        <Text style={{ fontSize: 16, fontWeight: '800', color: '#111827' }}>INLINE SHEET</Text>
                        <Text style={{ marginTop: 8, color: '#374151' }}>Si tu vois ça, le rendu inline fonctionne.</Text>
                    </BottomSheetView>
                </BottomSheet>
            ) : (
                <BottomSheetModal
                    ref={(ref) => {
                        modalRef.current = ref;
                    }}
                    snapPoints={snapPoints}
                    enablePanDownToClose
                    onAnimate={(fromIndex, toIndex) => console.log('[BSTest] modal animate', { fromIndex, toIndex })}
                    onChange={(index, position, type) => console.log('[BSTest] modal change', { index, position, type })}
                    backgroundStyle={{ backgroundColor: '#F3F4F6' }}
                    handleIndicatorStyle={{ backgroundColor: '#6B7280' }}
                >
                    <BottomSheetView style={{ flex: 1, padding: 16 }}>
                        <Text style={{ fontSize: 16, fontWeight: '800', color: '#111827' }}>MODAL SHEET</Text>
                        <Text style={{ marginTop: 8, color: '#374151' }}>Si tu vois ça, le rendu modal fonctionne.</Text>
                    </BottomSheetView>
                </BottomSheetModal>
            )}
        </SafeAreaView>
    );
}
