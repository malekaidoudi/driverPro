import React, { forwardRef, useCallback, useMemo } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import BottomSheetLib, {
    BottomSheetBackdrop,
    BottomSheetView,
    BottomSheetModal,
} from '@gorhom/bottom-sheet';
import { useTheme } from '../../hooks/useTheme';

interface BottomSheetProps {
    children: React.ReactNode;
    snapPoints?: (string | number)[];
    index?: number;
    onChange?: (index: number) => void;
    enablePanDownToClose?: boolean;
    style?: ViewStyle;
}

export const BottomSheet = forwardRef<BottomSheetLib, BottomSheetProps>(
    (
        {
            children,
            snapPoints: customSnapPoints,
            index = 0,
            onChange,
            enablePanDownToClose = true,
            style,
        },
        ref
    ) => {
        const { colors } = useTheme();

        const snapPoints = useMemo(
            () => customSnapPoints || ['25%', '50%', '90%'],
            [customSnapPoints]
        );

        const renderBackdrop = useCallback(
            (props: any) => (
                <BottomSheetBackdrop
                    {...props}
                    disappearsOnIndex={-1}
                    appearsOnIndex={0}
                    opacity={0.5}
                />
            ),
            []
        );

        const handleStyle: ViewStyle = {
            backgroundColor: colors.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
        };

        const handleIndicatorStyle: ViewStyle = {
            backgroundColor: colors.textSecondary,
            width: 40,
            height: 4,
        };

        return (
            <BottomSheetLib
                ref={ref}
                index={index}
                snapPoints={snapPoints}
                onChange={onChange}
                enablePanDownToClose={enablePanDownToClose}
                backdropComponent={renderBackdrop}
                handleStyle={handleStyle}
                handleIndicatorStyle={handleIndicatorStyle}
                backgroundStyle={{ backgroundColor: colors.surface }}
            >
                <BottomSheetView style={[styles.contentContainer, { backgroundColor: colors.surface }, style]}>
                    {children}
                </BottomSheetView>
            </BottomSheetLib>
        );
    }
);

interface BottomSheetModalWrapperProps extends BottomSheetProps {
    onDismiss?: () => void;
}

export const BottomSheetModalWrapper = forwardRef<BottomSheetModal, BottomSheetModalWrapperProps>(
    (
        {
            children,
            snapPoints: customSnapPoints,
            onChange,
            onDismiss,
            style,
        },
        ref
    ) => {
        const { colors } = useTheme();

        const snapPoints = useMemo(
            () => customSnapPoints || ['50%', '90%'],
            [customSnapPoints]
        );

        const renderBackdrop = useCallback(
            (props: any) => (
                <BottomSheetBackdrop
                    {...props}
                    disappearsOnIndex={-1}
                    appearsOnIndex={0}
                    opacity={0.5}
                />
            ),
            []
        );

        const handleStyle: ViewStyle = {
            backgroundColor: colors.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
        };

        const handleIndicatorStyle: ViewStyle = {
            backgroundColor: colors.textSecondary,
            width: 40,
            height: 4,
        };

        return (
            <BottomSheetModal
                ref={ref}
                snapPoints={snapPoints}
                onChange={onChange}
                onDismiss={onDismiss}
                backdropComponent={renderBackdrop}
                handleStyle={handleStyle}
                handleIndicatorStyle={handleIndicatorStyle}
                backgroundStyle={{ backgroundColor: colors.surface }}
            >
                <BottomSheetView style={[styles.contentContainer, { backgroundColor: colors.surface }, style]}>
                    {children}
                </BottomSheetView>
            </BottomSheetModal>
        );
    }
);

const styles = StyleSheet.create({
    contentContainer: {
        flex: 1,
        padding: 20,
        paddingBottom: 34,
    },
});
