/*
 * @Author: tonyYo
 * @Date: 2025-06-11 15:36:10
 * @LastEditors: tonyYo
 * @LastEditTime: 2025-06-12 10:00:00
 * @FilePath: /expo-webrtc-demo/lib/MqttSignalingClient.ts
 * @Description: 这是从 WebSocket 版本 (SignalingClientV3) 改造而来的 MQTT 信令客户端。
 *               它保持了相同的公共接口和事件，但底层通信协议换成了 MQTT。
 */

// import * as mqtt from 'mqtt/dist/mqtt';
import * as mqtt from 'mqtt';
console.log('%c____connect___', 'color:red', mqtt, mqtt.connect);
// import connect from 'mqtt/build/lib/connect/index.d.ts';
// /Volumes/HIKSEMI/web-test/WebRTC-1/expo-webrtc-demo/node_modules/mqtt/build/lib/connect/index.d.ts
// import type RTCPeerConnectionState from 'react-native-webrtc/lib/typescript/RTCPeerConnection.d.ts';
import type {
  BaseMessageData,
  CallOptions,
  EventPayloads,
  SignalPostMessage,
  SignalReceverMessage,
} from '@/types/signal_v3'; // 保持与之前相同的类型定义
import { newGuid } from '@/lib/util';

// --- 新增: 定义与 mqtt.js 服务器匹配的 MQTT 主题 ---
const TOPICS = {
  // 客户端发布消息到这些主题
  REGISTER: 'webrtc/register',
  CONNECT: 'webrtc/connect',
  CALL: 'webrtc/call',
  OFFER: 'webrtc/offer',
  ANSWER: 'webrtc/answer',
  ICE_CANDIDATE: 'webrtc/ice_candidate',
  CODE_RATE: 'webrtc/code_rate',
  OFFLINE: 'webrtc/offline',

  // 事件到主题的映射
  EVENT_TO_TOPIC_MAP: {
    _register: 'webrtc/register',
    __connectto: 'webrtc/connect',
    __call: 'webrtc/call',
    _offer: 'webrtc/offer',
    __answer: 'webrtc/answer',
    __ice_candidate: 'webrtc/ice_candidate',
    _ice_candidate: 'webrtc/ice_candidate', // 注意：客户端和设备端ice都发到同一个主题
    __code_rate: 'webrtc/code_rate',
    __disconnected: 'webrtc/offline', // 客户端主动断开也视为离线
  } as const, // 使用 as const 以获得更强的类型提示
};

const coverIceServers = (config: string): RTCConfiguration => {
  return JSON.parse(config);
};

export class MqttSignalingClient {
  private client: mqtt.MqttClient | null = null;
  private brokerUrl: string;
  public meid: string; // 本客户端的唯一ID (peerId)
  private listeners: Map<keyof EventPayloads, Array<(data: any) => void>> =
    new Map();
  private connected: boolean = false;

  // --- 不再需要的属性 ---
  // private pingInterval: number | null = null; // MQTT 库自带 keepalive 机制

  // --- WebRTC 会话相关属性 (保持不变) ---
  private source: string = 'MainStream';
  private audioEnable: string = 'recvonly';
  private videoEnable: string = 'recvonly';
  private connectmode: string = 'live';
  private datachannelEnable: boolean = false;
  public to: string = '';
  private sessionId: string = '';

  /**
   * @param brokerUrl MQTT Broker 的地址, 例如: 'ws://192.168.1.100:9001'
   * @param meid 当前客户端的唯一标识符
   */
  constructor(brokerUrl: string | undefined, meid: string) {
    if (!brokerUrl) {
      throw new Error('MQTT Broker URL is required');
    }
    this.brokerUrl = brokerUrl;
    // // 对于移动端，建议使用 ws:// 或 wss:// 协议
    // if (!brokerUrl.startsWith('wss://') && !brokerUrl.startsWith('ws://')) {
    //   console.warn(
    //     'MQTT URL does not start with ws:// or wss://. This might not work in React Native. Prepending ws://'
    //   );
    //   this.brokerUrl = `ws://${brokerUrl}`;
    // } else {
    //   this.brokerUrl = brokerUrl;
    // }
    this.meid = meid;
    console.log(`[MqttSignalingClient] Initialized with meid: ${this.meid}`);
  }

  // --- 事件监听系统 (完全保持不变) ---
  public on<E extends keyof EventPayloads>(
    event: E,
    callback: (data: EventPayloads[E]) => void
  ): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  public off<E extends keyof EventPayloads>(
    event: E,
    callback: (data: EventPayloads[E]) => void
  ): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(callback);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
  }

  public removeAllListeners(event?: keyof EventPayloads): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  private _emit<E extends keyof EventPayloads>(
    event: E,
    data: EventPayloads[E]
  ): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      [...eventListeners].forEach((listener) => {
        try {
          listener(data);
        } catch (error) {
          console.error(
            `[MqttSignalingClient] Error in listener for event '${event}':`,
            error
          );
        }
      });
    }
  }

  // --- 连接方法 (核心改造) ---
  public connect(): Promise<void> {
    console.log('[MqttSignalingClient] Connecting..._______');
    return new Promise((resolve, reject) => {
      if (this.client && this.client.connected) {
        console.warn('[MqttSignalingClient] Already connected.');
        resolve();
        return;
      }

      console.log(
        `[MqttSignalingClient] Connecting to MQTT Broker: ${this.brokerUrl}`,
        mqtt.connect
      );
      // 使用 meid 作为 MQTT 的 clientId
      // this.client = mqtt.connect(this.brokerUrl, {
      this.client = mqtt.connect({
        host: '192.168.3.65', // Broker 的 IP 地址
        port: 9001, // WebSocket 端口
        protocol: 'ws' as 'ws', // 显式指定协议
        path: '/mqtt', // Mosquitto WebSocket 的默认路径，通常是 /mqtt

        // MQTT 协议选项
        clientId: this.meid,
        protocolVersion: 4,
        protocolId: 'MQTT',
        clean: true,
        keepalive: 30, // 保持 30 秒心跳
        reconnectPeriod: 1000,
        connectTimeout: 30 * 1000,
      });

      this.client.on('connect', () => {
        console.log(
          '[MqttSignalingClient] MQTT Broker connection established.'
        );
        this.connected = true;

        // 核心: 订阅专门用于接收发给自己的消息的主题
        const userTopic = `webrtc/user/${this.meid}`;
        this.client?.subscribe(userTopic, { qos: 1 }, (err) => {
          if (err) {
            console.error(
              `[MqttSignalingClient] Failed to subscribe to topic: ${userTopic}`,
              err
            );
            this._emit('error', err);
            reject(err);
            return;
          }
          console.log(
            `[MqttSignalingClient] Subscribed to personal topic: ${userTopic}`
          );

          // 连接成功后，立即向服务器注册自己
          this.registerDevice();

          this._emit('connected', undefined);
          resolve();
        });
      });

      this.client.on('message', (topic, payload) => {
        // 所有发给本客户端的消息都会在这里处理
        this._handleMessage(payload);
      });

      this.client.on('error', (error) => {
        console.error('[MqttSignalingClient] MQTT error:', error);
        this.connected = false;
        this._emit('error', error);
        // 如果连接Promise还没有解决，就拒绝它
        if (!this.connected) {
          reject(error);
        }
      });

      this.client.on('close', () => {
        console.log('[MqttSignalingClient] MQTT connection closed.');
        this.connected = false;
        this._emit('disconnected', 'Connection closed');
      });
    });
  }

  // --- 消息处理 (逻辑不变, 来源改变) ---
  private _handleMessage(payload: Buffer) {
    try {
      const message = JSON.parse(payload.toString()) as
        | SignalReceverMessage
        | SignalPostMessage;
      console.log(
        `%c[MQTT] Received event: ${message.event}`,
        'background-color:aqua;',
        message
      );

      // switch 逻辑与 WebSocket 版本完全相同
      switch (message.event) {
        case '__answer':
          this._emit('answer', message.data);
          break;

        case '_create':
          if (typeof message.data.iceServers !== 'string') {
            throw new Error('Invalid iceServers data type');
          }
          const iceServersData = coverIceServers(message.data.iceServers);
          const createData = {
            ...message.data,
            iceServers: JSON.stringify(iceServersData),
          };
          this._emit('create', createData);
          break;

        case '__call': // <--- 添加这个 case
          this._emit('call', message.data);
          break;

        case '_offer':
          this._emit('offer', message.data);
          break;

        case '_ice_candidate':
          this._emit('deviceIceCandidate', message.data);
          break;

        case '__ice_candidate':
          // 注意：服务器转发后事件名可能改变，这里保持兼容
          this._emit('clientIceCandidate', message.data);
          break;

        case '__code_rate':
          this._emit('changeBitrate', message.data);
          break;

        // _pong 事件不再需要，MQTT库自动处理
        default:
          console.warn(
            '[MqttSignalingClient] Received unknown message event:',
            message
          );
      }
    } catch (error) {
      console.error(
        '[MqttSignalingClient] Error parsing message or in callback:',
        error
      );
      this._emit('error', String(error));
    }
  }

  // --- 断开连接方法 (核心改造) ---
  public disconnect() {
    console.trace();
    console.log('[MqttSignalingClient] Disconnecting...');
    if (this.client) {
      // 优雅离线：通知服务器本客户端已下线
      const offlinePayload = JSON.stringify({ peerId: this.meid });
      this.client.publish(TOPICS.OFFLINE, offlinePayload, { qos: 1 }, (err) => {
        // 不管发布成功与否，都继续关闭连接
        if (err) console.error('Failed to publish offline message', err);

        this.client?.end(true, () => {
          console.log('[MqttSignalingClient] MQTT client terminated.');
        });
      });
    }
    this.removeAllListeners();
    this.client = null;
    this.connected = false;
  }

  // --- 私有辅助方法 (保持不变) ---
  private _generateMessageId(): string {
    return newGuid();
  }

  private _buildBaseMessageData(): Omit<BaseMessageData, 'messageId'> {
    return {
      sessionId: this.sessionId,
      sessionType: 'IE',
      from: this.meid,
      to: this.to,
    };
  }

  // --- 消息发送方法 (核心改造) ---
  private _sendMessage(payload: SignalPostMessage | SignalReceverMessage) {
    if (!this.client || !this.client.connected) {
      console.error(
        '[MqttSignalingClient] MQTT not connected. Cannot send message:',
        payload
      );
      return;
    }

    // 根据事件类型，找到要发布到的 MQTT 主题
    const event = payload.event as keyof typeof TOPICS.EVENT_TO_TOPIC_MAP;
    const topic = TOPICS.EVENT_TO_TOPIC_MAP[event];

    if (!topic) {
      console.error(
        `[MqttSignalingClient] No topic mapping found for event: ${event}`
      );
      return;
    }

    // 根据 mqtt.js 服务器的逻辑，原始消息需要包含 clientId
    const messageToSend = {
      event: payload.event,
      data: payload.data,
      clientId: this.meid, // 服务器需要此字段来识别发送方
    };

    const messageStr = JSON.stringify(messageToSend);

    console.log(
      `%c[MQTT] Publishing to topic '${topic}':`,
      'background-color:green;color:aqua',
      messageToSend
    );

    this.client.publish(topic, messageStr, { qos: 1 }, (err) => {
      if (err) {
        console.error(
          `[MqttSignalingClient] Failed to publish message to ${topic}`,
          err
        );
      }
    });
  }

  // --- 公共 API 方法 (几乎不变, 只调用 _sendMessage) ---

  public isConnected(): boolean {
    return this.connected && !!this.client?.connected;
  }

  /**
   * (内部使用) 注册本设备到信令服务器
   */
  private registerDevice() {
    const message: SignalReceverMessage = {
      event: '_register',
      data: { peerId: this.meid },
    };
    this._sendMessage(message);
  }

  /**
   * `registerViewerId` 在这个MQTT模型中不再需要。
   * 客户端的身份由 `meid`（即MQTT的clientId）唯一确定。
   * 此方法保留为空或移除，以避免混淆。
   */
  public registerViewerId(viewerId: string) {
    console.warn(
      '[MqttSignalingClient] registerViewerId is obsolete in this MQTT model. Registration is handled automatically on connect.'
    );
  }

  public initiateSession(peerId: string, sessionId: string) {
    this.to = peerId;
    this.sessionId = sessionId;
    this._sendMessage({
      event: '__connectto',
      data: {
        ...this._buildBaseMessageData(),
        messageId: this._generateMessageId(),
      },
    });
  }

  public sendCall(
    peerId: string,
    sessionId: string, // 注意：在你的 DeviceBtn.tsx 中，这里传入的是 viewerId，可能需要调整
    options: CallOptions = {}
  ) {
    this.to = peerId;
    this.sessionId = sessionId;
    const callData = {
      mode: this.connectmode,
      source: this.source,
      datachannel: this.datachannelEnable ? 'true' : 'false',
      audio: this.audioEnable,
      video: this.videoEnable,
      ...{
        user: options.user ?? '',
        pwd: options.pwd ?? '',
        iceservers: options.iceServers ?? '',
      },
    } as const;
    this._sendMessage({
      event: '__call',
      data: {
        ...this._buildBaseMessageData(),
        messageId: this._generateMessageId(),
        ...callData,
      },
    });
  }

  public sendOffer({
    sdp,
    peerId,
    sessionId,
  }: {
    sdp: string;
    peerId: string;
    sessionId: string;
  }) {
    this.sessionId = sessionId;
    this.to = peerId;
    const message: SignalReceverMessage = {
      event: '_offer',
      data: {
        ...this._buildBaseMessageData(),
        messageId: this._generateMessageId(),
        sdp: sdp,
        type: 'offer',
        state: 'successed',
        iceservers: '', // 根据需要填写
      },
    };
    this._sendMessage(message);
  }

  public sendAnswer(sdp: string, answerType: RTCSdpType) {
    this._sendMessage({
      event: '__answer',
      data: {
        ...this._buildBaseMessageData(),
        messageId: this._generateMessageId(),
        sdp,
        type: answerType,
      },
    });
  }

  public sendChangeBitrate(bitrate: number) {
    this._sendMessage({
      event: '__code_rate',
      data: {
        ...this._buildBaseMessageData(),
        messageId: this._generateMessageId(),
        bitrate: bitrate,
      },
    });
  }

  public clientSendIceCandidate(candidateInfo: string) {
    this._sendMessage({
      event: '__ice_candidate',
      data: {
        ...this._buildBaseMessageData(),
        messageId: this._generateMessageId(),
        candidate: candidateInfo,
      },
    });
  }

  public deviceSendIceCandidate(candidateInfo: string) {
    this._sendMessage({
      event: '_ice_candidate',
      data: {
        ...this._buildBaseMessageData(),
        messageId: this._generateMessageId(),
        candidate: candidateInfo,
      },
    });
  }

  public disconnectSession(peerId: string, sessionId: string) {
    this.to = peerId;
    this.sessionId = sessionId;
    this._sendMessage({
      event: '__disconnected',
      data: {
        ...this._buildBaseMessageData(),
        messageId: this._generateMessageId(),
      },
    });
  }
}
