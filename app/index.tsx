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
  return (
    <SafeAreaView style={styles.container}>

      <Link
        href={{
          pathname: '/viewer',
          params: { serno: 'RHZL-00-WTSN-9S3D-00000727' }
        }}
        style={styles.link}
      >
        Viewer V2
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