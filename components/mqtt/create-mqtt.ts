import { createMqttClient, MqttConfig } from '@d11/react-native-mqtt';
import { MqttClient } from '@d11/react-native-mqtt/dist/Mqtt/MqttClient';

export const createMqtt = async (
  mqttConfig: MqttConfig
): Promise<MqttClient> => {
  const client = await createMqttClient({
    clientId: mqttConfig.clientId,
    host: mqttConfig.host,
    port: mqttConfig.port,
    options: {
      password: '',
      enableSslConfig: false,
      autoReconnect: true,
      maxBackoffTime: mqttConfig.options?.maxBackoffTime,
      retryCount: mqttConfig.options?.retryCount,
      cleanSession: mqttConfig.options?.cleanSession,
      keepAlive: mqttConfig.options?.keepAlive,
      jitter: mqttConfig.options?.jitter,
      username: '',
    },
  });
  if (!client) {
    throw new Error('Failed to create MQTT client');
  }
  return client;
};
