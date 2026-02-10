import React from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { MagnifyingGlassPlus, CopySimple, Trash, CaretRight } from 'phosphor-react-native';
import { FormSectionProps } from './types';

interface ActionMenuProps extends FormSectionProps {
    onPressChangeAddress?: () => void;
    onPressDuplicateStop?: () => void;
    onPressDeleteStop?: () => void;
}

export function ActionMenu({
    colors,
    onPressChangeAddress,
    onPressDuplicateStop,
    onPressDeleteStop,
}: ActionMenuProps) {
    const textSecondary = colors.textSecondary;

    return (
        <View style={{ marginTop: 20, gap: 2 }}>
            <TouchableOpacity
                onPress={onPressChangeAddress}
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 16,
                    paddingHorizontal: 4,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                }}
            >
                <MagnifyingGlassPlus size={22} color={colors.textPrimary} />
                <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '500', marginLeft: 12, flex: 1 }}>Changer l'adresse</Text>
                <CaretRight size={20} color={textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
                onPress={onPressDuplicateStop}
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 16,
                    paddingHorizontal: 4,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                }}
            >
                <CopySimple size={22} color={colors.textPrimary} />
                <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '500', marginLeft: 12, flex: 1 }}>Dupliquer l'arrêt</Text>
                <CaretRight size={20} color={textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
                onPress={() => {
                    Alert.alert('Supprimer', 'Supprimer cet arrêt ?', [
                        { text: 'Annuler', style: 'cancel' },
                        {
                            text: 'Supprimer',
                            style: 'destructive',
                            onPress: () => onPressDeleteStop?.(),
                        },
                    ]);
                }}
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 16,
                    paddingHorizontal: 4,
                }}
            >
                <Trash size={22} color="#DC2626" />
                <Text style={{ color: '#DC2626', fontSize: 16, fontWeight: '500', marginLeft: 12, flex: 1 }}>Supprimer l'arrêt</Text>
                <CaretRight size={20} color="#DC2626" />
            </TouchableOpacity>
        </View>
    );
}

export default ActionMenu;
