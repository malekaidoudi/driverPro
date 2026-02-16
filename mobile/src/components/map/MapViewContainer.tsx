import React, { memo, forwardRef, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { NavigationArrow, MapPin } from 'phosphor-react-native';

interface RoutePoint {
    address: string;
    latitude: number;
    longitude: number;
}

interface MapViewContainerProps {
    userLocation: { latitude: number; longitude: number };
    currentLocation: { latitude: number; longitude: number };
    destination: RoutePoint | null;
    routeCoordinates: { latitude: number; longitude: number }[];
    isNavigating: boolean;
    onLongPress: (event: any) => void;
    primaryColor: string;
}

// Static initial region - Lyon center
const INITIAL_REGION: Region = {
    latitude: 45.764043,
    longitude: 4.835659,
    latitudeDelta: 0.1,
    longitudeDelta: 0.1,
};

// UPS-themed map style
const UPS_MAP_STYLE = [
    { elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#e0e0e0' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#e8e0d5' }] },
    { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#c5b8a8' }] },
    { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#f0ebe5' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9e8f5' }] },
    { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#c5e8c5' }] },
    { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
];

const MapViewContainer = memo(forwardRef<MapView, MapViewContainerProps>(function MapViewContainer(
    {
        userLocation,
        currentLocation,
        destination,
        routeCoordinates,
        isNavigating,
        onLongPress,
        primaryColor,
    },
    ref
) {
    // Memoize marker coordinate to prevent re-renders
    const markerCoordinate = useMemo(() => 
        isNavigating ? currentLocation : userLocation,
        [isNavigating, currentLocation, userLocation]
    );

    const destinationCoordinate = useMemo(() => 
        destination ? { latitude: destination.latitude, longitude: destination.longitude } : null,
        [destination?.latitude, destination?.longitude]
    );

    return (
        <MapView
            ref={ref}
            style={StyleSheet.absoluteFillObject}
            provider={PROVIDER_GOOGLE}
            initialRegion={INITIAL_REGION}
            showsUserLocation={false}
            showsMyLocationButton={false}
            customMapStyle={UPS_MAP_STYLE}
            onLongPress={onLongPress}
        >
            {/* User location marker */}
            <Marker
                coordinate={markerCoordinate}
                title="Ma position"
                anchor={{ x: 0.5, y: 0.5 }}
                flat={true}
            >
                <View style={styles.userMarker}>
                    <NavigationArrow size={24} color={primaryColor} weight="fill" />
                </View>
            </Marker>

            {/* Destination marker */}
            {destinationCoordinate && (
                <Marker
                    coordinate={destinationCoordinate}
                    title={destination?.address}
                >
                    <View style={styles.destinationMarker}>
                        <MapPin size={32} color="#EF4444" weight="fill" />
                    </View>
                </Marker>
            )}

            {/* Route polyline - double stroke style */}
            {routeCoordinates.length > 1 && (
                <>
                    <Polyline
                        key="route-outer"
                        coordinates={routeCoordinates}
                        strokeColor="#000"
                        strokeWidth={14}
                        zIndex={998}
                    />
                    <Polyline
                        key="route-inner"
                        coordinates={routeCoordinates}
                        strokeColor="#FFB500"
                        strokeWidth={8}
                        zIndex={999}
                    />
                </>
            )}
        </MapView>
    );
}));

const styles = StyleSheet.create({
    userMarker: {
        backgroundColor: '#351C15',
        borderRadius: 20,
        padding: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
        elevation: 5,
    },
    destinationMarker: {
        alignItems: 'center',
    },
});

export default MapViewContainer;
