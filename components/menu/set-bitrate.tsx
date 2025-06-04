import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Pressable, BackHandler, Alert } from 'react-native';
import { RTCDataChannelSendMessageProps } from '../type/signal_v2';

interface SetBitrateButtonProps {
  sendChangeBitrate: (data: RTCDataChannelSendMessageProps) => void;
  currentBitrate: number; // 可选的初始码率
}

// 码率配置
const BITRATE_OPTIONS = [
  { label: '低质量', value: 250000, description: '250 kbps' },
  { label: '标准质量', value: 500000, description: '500 kbps' },
  { label: '高质量', value: 1000000, description: '1 Mbps' },
  { label: '超高质量', value: 2500000, description: '2.5 Mbps' },
];

const DEFAULT_BITRATE = 2500000; // 默认码率

export default function SetBitrateButton({ sendChangeBitrate, currentBitrate }: SetBitrateButtonProps) {
  const [selectedBitrate, setSelectedBitrate] = useState(DEFAULT_BITRATE);
  const [oldValue, setOldValue] = useState(DEFAULT_BITRATE);
  const [isPickerVisible, setIsPickerVisible] = useState(false); // 控制自定义弹窗的显示

  const handleBitrateChange = (bitrate: number) => {
    setOldValue(selectedBitrate)
    setSelectedBitrate(bitrate);
    console.log('_____10001', selectedBitrate, oldValue)
    sendChangeBitrate({
      type: 'changeBitrate',
      data: JSON.stringify({
        bitrate
      })
    });
    setIsPickerVisible(false); // 选择后关闭弹窗
  };

  const openPicker = () => setIsPickerVisible(true);
  const closePicker = () => {
    setIsPickerVisible(false);
    return true; //  BackHandler 需要返回 true 表示事件已处理
  };

  // 处理 Android 返回按钮
  useEffect(() => {
    const backAction = () => {
      if (isPickerVisible) {
        closePicker();
        return true; // 阻止默认返回行为 (如退出应用)
      }
      return false; // 如果弹窗未打开，则执行默认返回行为
    };

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      backAction
    );

    return () => backHandler.remove(); // 组件卸载时移除监听
  }, [isPickerVisible]); // 依赖 isPickerVisible 状态

  const currentOption = BITRATE_OPTIONS.find(opt => opt.value === selectedBitrate);

  useEffect(() => {
    // 初始化时设置初始码率
    if (currentBitrate !== selectedBitrate) {
      console.log('12341241243', currentBitrate, selectedBitrate);
      setSelectedBitrate(oldValue);
      Alert.alert('码率设置失败，请重试');
    }
  }, [currentBitrate]); // 空数组表示只在组件挂载时执行一次

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.mainButton} onPress={openPicker}>
        <Text style={styles.mainButtonText}>
          当前码率: {currentOption?.description || '未设置'}
        </Text>
      </TouchableOpacity>

      {/* 自定义弹窗 */}
      {isPickerVisible && (
        <Pressable style={styles.customModalOverlay} onPress={closePicker}>
          {/* 使用 Pressable 并阻止事件冒泡，防止点击内容区域导致关闭 */}
          <Pressable style={styles.customModalContent} onPress={(e) => e.stopPropagation()}>
            {BITRATE_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.customModalOptionButton,
                  selectedBitrate === option.value && styles.customModalSelectedOptionButton
                ]}
                onPress={() => handleBitrateChange(option.value)}
              >
                <Text style={[
                  styles.customModalOptionText,
                  selectedBitrate === option.value && styles.customModalSelectedOptionText
                ]}>
                  {option.label}
                </Text>
                <Text style={[
                  styles.customModalDescriptionText,
                  selectedBitrate === option.value && styles.customModalSelectedDescriptionText
                ]}>
                  {option.description}
                </Text>
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
  },
  mainButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 150,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  mainButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  mainButtonDescription: {
    color: '#e0e0e0',
    fontSize: 12,
    marginTop: 2,
  },
  // 自定义弹窗样式
  customModalOverlay: {
    position: 'absolute', // 关键：覆盖整个屏幕
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)', // 半透明遮罩
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000, // 确保在最上层
  },
  customModalContent: {
    width: 200,
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 10,
    alignItems: 'stretch',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5, // Android 阴影
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 5
  },
  customModalOptionButton: {
    width: '49%',
    backgroundColor: '#f0f0f0',
    padding: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  customModalSelectedOptionButton: {
    backgroundColor: '#007AFF',
    borderColor: '#0056b3',
  },
  customModalOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  customModalSelectedOptionText: {
    color: '#fff',
  },
  customModalDescriptionText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  customModalSelectedDescriptionText: {
    color: '#e0e0e0',
  },
  customCloseButton: {
    marginTop: 15,
    backgroundColor: '#6c757d',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  customCloseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});