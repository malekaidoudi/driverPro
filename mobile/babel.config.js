module.exports = function (api) {
    api.cache(true);
    return {
        presets: ['babel-preset-expo'],
        plugins: [
            // Plugin worklets DOIT être avant reanimated pour le frameProcessor
            'react-native-worklets-core/plugin',
            // Reanimated DOIT être en dernier
            'react-native-reanimated/plugin',
        ],
    };
};
