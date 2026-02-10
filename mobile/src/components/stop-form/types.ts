import { StopType, StopPriority } from '../../types';

export type StopOrder = 'first' | 'auto' | 'last';

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
