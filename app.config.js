const IS_DEV = process.env.APP_VARIANT === 'development';

module.exports = {
    expo: {
        name: IS_DEV ? 'ChallengeApp (Dev)' : 'ChallengeApp',
        slug: 'challenge-app',
        version: '1.0.0',
        orientation: 'portrait',
        userInterfaceStyle: 'automatic',
        splash: { backgroundColor: '#111827' },
        assetBundlePatterns: ['**/*'],
        runtimeVersion: {
            policy: 'appVersion',
        },
        updates: {
            url: 'https://u.expo.dev/1a478fc3-3c75-472c-81ab-c26e8c00265e',
        },
        ios: {
            supportsTablet: true,
            bundleIdentifier: IS_DEV ? 'com.tonpseudo.challengeapp.dev' : 'com.tonpseudo.challengeapp',
            infoPlist: {
                NSLocationWhenInUseUsageDescription: "L'app utilise ta position pour mesurer la distance parcourue pendant tes activités.",
            },
        },
        android: {
            package: IS_DEV ? 'com.tonpseudo.challengeapp.dev' : 'com.tonpseudo.challengeapp',
            permissions: ['ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION'],
        },
        plugins: [
            ['expo-location', { locationAlwaysAndWhenInUsePermission: "L'app utilise ta position pour mesurer la distance parcourue." }],
        ],
        extra: {
            appVariant: IS_DEV ? 'development' : 'production',
            eas: {
                projectId: '1a478fc3-3c75-472c-81ab-c26e8c00265e',
            },
        },
    },
};