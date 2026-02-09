import { View, Text, ScrollView, TouchableOpacity, Alert, Share } from 'react-native';
import { useTheme } from '../src/contexts/ThemeContext';
import { useRouter, Stack } from 'expo-router';
import { ArrowLeft, Share as ShareIcon, Trash, CheckCircle, XCircle, Warning } from 'phosphor-react-native';
import { useEffect, useState } from 'react';
import { getOCRTestLogs, exportOCRTestLogs, clearOCRTestLogs, OCRTestLog } from '../src/services/ocrTestLogger';

export default function OCRLogsScreen() {
    const { colors } = useTheme();
    const router = useRouter();
    const [logs, setLogs] = useState<OCRTestLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    useEffect(() => {
        loadLogs();
    }, []);

    const loadLogs = async () => {
        setLoading(true);
        const data = await getOCRTestLogs();
        setLogs(data);
        setLoading(false);
    };

    const handleExport = async () => {
        try {
            const report = await exportOCRTestLogs();
            await Share.share({
                message: report,
                title: 'Logs OCR DriverPro',
            });
        } catch (error) {
            Alert.alert('Erreur', 'Impossible d\'exporter les logs.');
        }
    };

    const handleClear = () => {
        Alert.alert(
            'Supprimer tous les logs',
            'Cette action est irréversible.',
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Supprimer',
                    style: 'destructive',
                    onPress: async () => {
                        await clearOCRTestLogs();
                        setLogs([]);
                    },
                },
            ]
        );
    };

    const toggleExpand = (id: string) => {
        setExpandedId(expandedId === id ? null : id);
    };

    const formatDate = (timestamp: string) => {
        const date = new Date(timestamp);
        return date.toLocaleString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getStatusIcon = (log: OCRTestLog) => {
        if (log.isCorrect === true) return <CheckCircle size={20} color={colors.success} weight="fill" />;
        if (log.isCorrect === false) return <XCircle size={20} color={colors.danger} weight="fill" />;
        return <Warning size={20} color={colors.warning} weight="fill" />;
    };

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: 'Logs OCR',
                    headerStyle: { backgroundColor: colors.background },
                    headerTintColor: colors.textPrimary,
                    headerLeft: () => (
                        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 16 }}>
                            <ArrowLeft size={24} color={colors.textPrimary} />
                        </TouchableOpacity>
                    ),
                    headerRight: () => (
                        <View style={{ flexDirection: 'row', gap: 16 }}>
                            <TouchableOpacity onPress={handleExport}>
                                <ShareIcon size={24} color={colors.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleClear}>
                                <Trash size={24} color={colors.danger} />
                            </TouchableOpacity>
                        </View>
                    ),
                }}
            />

            {loading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ color: colors.textSecondary }}>Chargement...</Text>
                </View>
            ) : logs.length === 0 ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
                    <Text style={{ color: colors.textSecondary, fontSize: 16, textAlign: 'center' }}>
                        Aucun log OCR enregistré.{'\n'}Les scans seront enregistrés ici.
                    </Text>
                </View>
            ) : (
                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
                    <Text style={{ color: colors.textSecondary, marginBottom: 16 }}>
                        {logs.length} scan(s) enregistré(s)
                    </Text>

                    {logs.map((log) => (
                        <TouchableOpacity
                            key={log.id}
                            onPress={() => toggleExpand(log.id)}
                            style={{
                                backgroundColor: colors.surface,
                                borderRadius: 12,
                                marginBottom: 12,
                                overflow: 'hidden',
                            }}
                        >
                            {/* Header */}
                            <View style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                padding: 12,
                                borderBottomWidth: expandedId === log.id ? 1 : 0,
                                borderBottomColor: colors.border,
                            }}>
                                {getStatusIcon(log)}
                                <View style={{ flex: 1, marginLeft: 12 }}>
                                    <Text style={{ color: colors.textPrimary, fontWeight: '600' }} numberOfLines={1}>
                                        {log.parsedResult.street || log.parsedResult.postalCode || 'Adresse non détectée'}
                                    </Text>
                                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                                        {formatDate(log.timestamp)}
                                        {log.parsedResult.city ? ` • ${log.parsedResult.city}` : ''}
                                    </Text>
                                </View>
                                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                                    {expandedId === log.id ? '▲' : '▼'}
                                </Text>
                            </View>

                            {/* Expanded details */}
                            {expandedId === log.id && (
                                <View style={{ padding: 12 }}>
                                    {/* RAW OCR */}
                                    <Text style={{ color: colors.warning, fontWeight: '600', marginBottom: 4 }}>
                                        📷 RAW OCR:
                                    </Text>
                                    <View style={{
                                        backgroundColor: colors.background,
                                        padding: 8,
                                        borderRadius: 8,
                                        marginBottom: 12,
                                    }}>
                                        <Text style={{ color: colors.textSecondary, fontSize: 11, fontFamily: 'monospace' }}>
                                            {log.rawText || '(vide)'}
                                        </Text>
                                    </View>

                                    {/* PARSED */}
                                    <Text style={{ color: colors.success, fontWeight: '600', marginBottom: 8 }}>
                                        📋 PARSED:
                                    </Text>
                                    <View style={{ gap: 4 }}>
                                        <FieldRow label="Rue" value={log.parsedResult.street} colors={colors} />
                                        <FieldRow label="CP" value={log.parsedResult.postalCode} colors={colors} />
                                        <FieldRow label="Ville" value={log.parsedResult.city} colors={colors} />
                                        <FieldRow label="Tél" value={log.parsedResult.phone} colors={colors} />
                                        <FieldRow label="Prénom" value={log.parsedResult.firstName} colors={colors} />
                                        <FieldRow label="Nom" value={log.parsedResult.lastName} colors={colors} />
                                    </View>

                                    {log.notes && (
                                        <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 8, fontStyle: 'italic' }}>
                                            Note: {log.notes}
                                        </Text>
                                    )}
                                </View>
                            )}
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            )}
        </View>
    );
}

function FieldRow({ label, value, colors }: { label: string; value?: string; colors: any }) {
    return (
        <View style={{ flexDirection: 'row' }}>
            <Text style={{ color: colors.textSecondary, width: 60, fontSize: 13 }}>{label}:</Text>
            <Text style={{
                color: value ? colors.textPrimary : colors.textSecondary,
                flex: 1,
                fontSize: 13,
                fontStyle: value ? 'normal' : 'italic',
            }}>
                {value || '(non détecté)'}
            </Text>
        </View>
    );
}
