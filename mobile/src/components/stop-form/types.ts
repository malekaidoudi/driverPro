import { StopType, StopPriority } from '../../types';

export type StopOrder = 'first' | 'auto' | 'last';

// Package finder types
export type PackageSize = 'small' | 'medium' | 'large';
export type PackageType = 'box' | 'bag' | 'letter';
export type VehiclePositionDepth = 'front' | 'middle' | 'back';
export type VehiclePositionSide = 'left' | 'right';
export type VehiclePositionLevel = 'floor' | 'shelf';

export interface PackageLocation {
    size?: PackageSize;
    type?: PackageType;
    depth?: VehiclePositionDepth;
    side?: VehiclePositionSide;
    level?: VehiclePositionLevel;
}

export interface StopFormData {
    address: string;
    city: string;
    postalCode: string;
    latitude: number;
    longitude: number;
    addressComplement: string;
    firstName: string;
    lastName: string;
    companyName: string;
    phoneNumber: string;
    packageCount: number;
    packageFinderId: string;
    packageLocation?: PackageLocation;
    order: StopOrder;
    type: StopType;
    priority: StopPriority;
    durationMinutes: number;
    timeWindowStart: string;
    timeWindowEnd: string;
}

export interface FormSectionProps {
    colors: {
        background: string;
        surface: string;
        textPrimary: string;
        textSecondary: string;
        primary: string;
        border: string;
        danger?: string;
    };
}
