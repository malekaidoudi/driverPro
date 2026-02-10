import React from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { FormSectionProps } from './types';

interface ContactSectionProps extends FormSectionProps {
    firstName: string;
    lastName: string;
    companyName: string;
    phoneNumber: string;
    isCompany: boolean;
    onFirstNameChange: (value: string) => void;
    onLastNameChange: (value: string) => void;
    onCompanyNameChange: (value: string) => void;
    onPhoneNumberChange: (value: string) => void;
    onIsCompanyChange: (value: boolean) => void;
}

export function ContactSection({
    colors,
    firstName,
    lastName,
    companyName,
    phoneNumber,
    isCompany,
    onFirstNameChange,
    onLastNameChange,
    onCompanyNameChange,
    onPhoneNumberChange,
    onIsCompanyChange,
}: ContactSectionProps) {
    const textSecondary = colors.textSecondary;

    return (
        <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <TouchableOpacity
                    onPress={() => onIsCompanyChange(false)}
                    style={{
                        paddingVertical: 6,
                        paddingHorizontal: 12,
                        borderRadius: 8,
                        backgroundColor: !isCompany ? colors.primary : colors.background,
                        marginRight: 8,
                    }}
                >
                    <Text style={{ color: !isCompany ? '#FFFFFF' : colors.textPrimary, fontSize: 12, fontWeight: '600' }}>
                        👤 Particulier
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => onIsCompanyChange(true)}
                    style={{
                        paddingVertical: 6,
                        paddingHorizontal: 12,
                        borderRadius: 8,
                        backgroundColor: isCompany ? colors.primary : colors.background,
                    }}
                >
                    <Text style={{ color: isCompany ? '#FFFFFF' : colors.textPrimary, fontSize: 12, fontWeight: '600' }}>
                        🏢 Société
                    </Text>
                </TouchableOpacity>
            </View>

            {isCompany ? (
                <View style={{ marginBottom: 12 }}>
                    <Text style={{ color: textSecondary, fontSize: 12, marginBottom: 6 }}>Nom de la société</Text>
                    <TextInput
                        value={companyName}
                        onChangeText={onCompanyNameChange}
                        placeholder="Nom de l'entreprise"
                        placeholderTextColor={textSecondary}
                        style={{
                            backgroundColor: colors.background,
                            borderRadius: 12,
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            color: colors.textPrimary,
                        }}
                    />
                </View>
            ) : (
                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
                    <View style={{ flex: 1 }}>
                        <Text style={{ color: textSecondary, fontSize: 12, marginBottom: 6 }}>Prénom</Text>
                        <TextInput
                            value={firstName}
                            onChangeText={onFirstNameChange}
                            placeholder="Prénom"
                            placeholderTextColor={textSecondary}
                            style={{
                                backgroundColor: colors.background,
                                borderRadius: 12,
                                paddingHorizontal: 12,
                                paddingVertical: 10,
                                color: colors.textPrimary,
                            }}
                        />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{ color: textSecondary, fontSize: 12, marginBottom: 6 }}>Nom</Text>
                        <TextInput
                            value={lastName}
                            onChangeText={onLastNameChange}
                            placeholder="Nom"
                            placeholderTextColor={textSecondary}
                            style={{
                                backgroundColor: colors.background,
                                borderRadius: 12,
                                paddingHorizontal: 12,
                                paddingVertical: 10,
                                color: colors.textPrimary,
                            }}
                        />
                    </View>
                </View>
            )}

            <Text style={{ color: textSecondary, fontSize: 12, marginBottom: 6 }}>Téléphone</Text>
            <TextInput
                value={phoneNumber}
                onChangeText={onPhoneNumberChange}
                placeholder="+33 6 12 34 56 78"
                placeholderTextColor={textSecondary}
                keyboardType="phone-pad"
                style={{
                    backgroundColor: colors.background,
                    borderRadius: 12,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    color: colors.textPrimary,
                    marginBottom: 12,
                }}
            />
        </View>
    );
}

export default ContactSection;
