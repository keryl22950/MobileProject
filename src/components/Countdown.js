import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme';

function splitDuration(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return { days, hours, minutes, seconds };
}

function pad(n) {
    return String(n).padStart(2, '0');
}

export default function Countdown({ target, label }) {
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);

    if (!target) return null;
    const diff = target.getTime() - now;
    const ended = diff <= 0;
    const { days, hours, minutes, seconds } = splitDuration(diff);

    return (
        <View style={styles.container}>
            {label && <Text style={styles.label}>{label}</Text>}
            {ended ? (
                <Text style={styles.ended}>Terminé</Text>
            ) : (
                <View style={styles.row}>
                    {days > 0 && (
                        <View style={styles.block}>
                            <Text style={styles.value}>{days}</Text>
                            <Text style={styles.unit}>j</Text>
                        </View>
                    )}
                    <View style={styles.block}><Text style={styles.value}>{pad(hours)}</Text><Text style={styles.unit}>h</Text></View>
                    <Text style={styles.sep}>:</Text>
                    <View style={styles.block}><Text style={styles.value}>{pad(minutes)}</Text><Text style={styles.unit}>m</Text></View>
                    <Text style={styles.sep}>:</Text>
                    <View style={styles.block}><Text style={styles.value}>{pad(seconds)}</Text><Text style={styles.unit}>s</Text></View>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { alignItems: 'center', marginVertical: 12 },
    label: { color: colors.muted, fontSize: 12, textTransform: 'uppercase', marginBottom: 6 },
    row: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
    block: { alignItems: 'center', minWidth: 40 },
    value: { color: colors.text, fontSize: 34, fontWeight: '800' },
    unit: { color: colors.muted, fontSize: 11, marginTop: -4 },
    sep: { color: colors.text, fontSize: 30, fontWeight: '800', marginBottom: 6 },
    ended: { color: colors.danger, fontSize: 22, fontWeight: '700' },
});