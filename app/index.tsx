/*
 * @Author: tonyYo
 * @Date: 2025-05-13 11:49:36
 * @LastEditors: tonyYo
 * @LastEditTime: 2025-05-16 11:44:03
 * @FilePath: /expo-webrtc-demo/app/index.tsx
 */
import { useState } from 'react';
import { View, StyleSheet, TextInput } from 'react-native';
import { Link, Stack } from 'expo-router';
import { SafeAreaView } from "react-native-safe-area-context";


export default function RouteScreen() {
  const [serno, setSerno] = useState('111');

  return (
    <SafeAreaView style={styles.container}>

      <TextInput
        style={styles.input}
        placeholder="输入设备号"
        onChangeText={setSerno}
        value={serno}
      />

      <Link
        href={{
          pathname: '/viewer/v2',
          params: { serno }
        }}
        style={styles.link}
      >
        查看直播间(v2)
      </Link>

      <Link
        href={{
          pathname: '/viewer',
          params: { serno }
        }}
        style={styles.link}
      >
        查看直播间
      </Link>

      <Link
        href={{
          pathname: '/viewer/newIndex',
          params: { serno }
        }}
        style={styles.link}
      >
        查看直播间(newIndex)
      </Link>

      <Link
        href={{
          pathname: '/master',
          params: { serno }
        }}
        style={styles.link}
      >
        我的直播间
      </Link>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    gap: 20,
  },
  input: {
    height: 40,
    width: '80%',
    margin: 12,
    borderWidth: 1,
    padding: 10,
    borderRadius: 5,
    borderColor: '#ccc',
  },
  link: {
    padding: 15,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});