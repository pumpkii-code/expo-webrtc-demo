/*
 * @Author: tonyYo
 * @Date: 2025-05-16 14:00:00
 * @LastEditors: tonyYo
 * @LastEditTime: 2025-05-16 14:00:00
 * @FilePath: /your-project/src/MqttSignalingClient.ts
 * @Description: An MQTT-based signaling client for WebRTC, mimicking the WebSocket client's API.
 */

// 导入 mqtt 库和所需的类型
import * as mqtt from 'mqtt';
import type { MqttClient, IClientOptions } from 'mqtt';
import type {
  BaseMessageData,
  CallOptions,
  EventPayloads, // 假设这些类型与 WebSocket 版本通用
  SignalPostMessage,
  SignalReceverMessage,
} from '@/types/signal_v3'; // 复用你的类型定义
import { newGuid } from '@/lib/util'; // 复用你的工具函数

// 这个函数与 WebSocket 版本完全相同
const coverIceServers = (config: string): RTCConfiguration => {
  console.log(
    '%c_____config_____',
    'background-color:aqua;color:white',
    config
  );
  return JSON.parse(config);
};

export class MqttSignalingClient {
  private client: MqttClient | null = null;
  private brokerUrl: string;
  public meid: string; // 'meid' is our clientId for MQTT

  // 事件监听器系统，与 WebSocket 版本完全相同
  private listeners: Map<keyof EventPayloads, Array<(data: any) => void>> =
    new Map();

  private connected: boolean = false;
  private pingInterval: number | null = null;

  // 状态属性，与 WebSocket 版本完全相同
  private source: string = 'MainStream';
  private audioEnable: string = 'recvonly';
  private videoEnable: string = 'recvonly';
  private connectmode: string = 'live';
  private datachannelEnable: boolean = false;
  public to: string = '';
  private sessionId: string = '';

  /**
   * 构造函数
   * @param brokerUrl MQTT Broker 的地址 (例如: 'ws://localhost:8910/mqtt' 或 'mqtt://localhost:1883')
   * @param meid 此客户端的唯一 ID，将用作 MQTT 的 clientId
   */
  constructor(brokerUrl: string | undefined, meid: string) {
    if (!brokerUrl) {
      throw new Error('MQTT broker URL is required');
    }
    console.log(
      `%c____当前连接的 MQTT Broker 是: __${brokerUrl}`,
      'background-color:orange;color:white'
    );
    this.brokerUrl = brokerUrl;
    this.meid = meid;
    console.log('_____this.meid (MQTT ClientId)_____', this.meid);
  }

  // --- 事件监听系统 (与 WebSocket 版本完全相同) ---

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
            `[MqttSignalingClient] Error in listener for event '${String(
              event
            )}':`,
            error
          );
        }
      });
    }
  }

  // --- 核心连接和消息处理方法 (已改造为 MQTT) ---

  /**
   * 连接到 MQTT Broker
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.client && this.client.connected) {
        console.warn('[MqttSignalingClient] Already connected.');
        resolve();
        return;
      }

      const options: IClientOptions = {
        clientId: this.meid,
        clean: true, // 设置为 true，确保断连后 broker 不会保存会话信息
        connectTimeout: 4000,
        /**
         * 强制使用 MQTT v3.1.1 协议版本。
         * 4 = MQTT v3.1.1
         * 5 = MQTT v5.0 (默认)
         * 这是为了适配只接受 v3.1.1 的 Aedes 服务器。
         */
        protocolVersion: 4,
      };

      console.log(
        `[MqttSignalingClient] Connecting to: ${this.brokerUrl} with clientId: ${this.meid}`,
        mqtt
      );
      this.client = mqtt.default.connect(this.brokerUrl, options);

      // 监听 'connect' 事件，表示成功连接到 Broker
      this.client.on('connect', (connack) => {
        console.log('[MqttSignalingClient] MQTT client connected.', connack);
        this.connected = true;

        // 关键步骤: 订阅用于接收消息的 topic
        const topicToSubscribe = `signal/to/${this.meid}`;
        console.log(
          '%c_____订阅的topic_____',
          'background-color:green;color:white',
          topicToSubscribe
        );
        this.client?.subscribe(topicToSubscribe, { qos: 1 }, (err) => {
          if (err) {
            console.error(
              `[MqttSignalingClient] Failed to subscribe to topic: ${topicToSubscribe}`,
              err
            );
            this._emit('error', err);
            reject(err);
          } else {
            console.log(
              `%c[MqttSignalingClient] Successfully subscribed to topic: ${topicToSubscribe}`,
              'background: green'
            );
            this._emit('connected', undefined);
            // this._sendPing();
            resolve();
          }
        });
      });

      // 监听 'message' 事件，处理从服务器收到的所有消息
      this.client.on('message', (topic, payload) => {
        this._handleMessage(topic, payload);
      });

      // 监听错误事件
      this.client.on('error', (error) => {
        console.error('[MqttSignalingClient] MQTT error:', error);
        this.connected = false;
        this._emit('error', error);
        reject(error);
      });

      // 监听关闭事件
      this.client.on('close', () => {
        console.log('[MqttSignalingClient] MQTT connection closed.');
        this.connected = false;
        this._emit('disconnected', 'Connection closed');
        if (this.pingInterval) {
          clearInterval(this.pingInterval);
          this.pingInterval = null;
        }
      });
    });
  }

  /**
   * 处理收到的 MQTT 消息
   * @param topic 消息来源的 topic
   * @param payload 消息内容 (Buffer)
   */
  private _handleMessage(topic: string, payload: Buffer) {
    try {
      const messageStr = payload.toString();
      const message = JSON.parse(messageStr) as
        | SignalReceverMessage
        | SignalPostMessage;

      console.log(
        `%c__收到MQTT消息 on topic [${topic}] 事件 [${message.event}]_____`,
        'background-color:orange;',
        message
      );

      // 使用 _emit 触发事件，这部分逻辑与 WebSocket 版本完全一致
      switch (message.event) {
        case '__answer':
          this._emit('answer', message.data);
          break;
        case '_create':
          const iceServersData = coverIceServers(message.data.iceServers);
          const createData = {
            ...message.data,
            iceServers: JSON.stringify(iceServersData),
          };
          this._emit('create', createData);
          break;
        case '__call':
          this._emit('call', message.data);
          break;
        case '_offer':
          this._emit('offer', message.data);
          break;
        case '__answer':
          this._emit('answer', message.data);
          break;
        case '_ice_candidate':
          this._emit('deviceIceCandidate', message.data);
          break;
        case '__ice_candidate':
          this._emit('clientIceCandidate', message.data);
          break;
        case '__code_rate':
          this._emit('changeBitrate', message.data);
          break;
        case '_pong':
          this._emit('pong', undefined);
          break;
        default:
          console.warn(
            '[MqttSignalingClient] Received unknown message event:',
            message.event
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

  /**
   * 断开与 MQTT Broker 的连接
   */
  public disconnect() {
    console.log('断开 MQTT 连接++++1.0');
    if (this.client) {
      console.log('断开 MQTT 连接++++2.0');
      this.client.end(true); // true 表示强制关闭，不等待离线消息队列
      this.client = null;
    }
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    this.removeAllListeners();
    this.connected = false;
  }

  /**
   * 通过 MQTT 发布消息
   * @param payload 要发送的消息对象
   */
  private _sendMessage(payload: SignalPostMessage | SignalReceverMessage) {
    if (this.client && this.client.connected) {
      const topicToPublish = `signal/from/${this.meid}`;
      const messageStr = JSON.stringify(payload);

      console.log(
        `%c______Publishing MQTT message to [${topicToPublish}] 事件 [${payload.event}].........`,
        'background-color:purple;color:white',
        payload
      );

      this.client.publish(topicToPublish, messageStr, { qos: 1 }, (err) => {
        if (err) {
          console.error(
            '[MqttSignalingClient] Failed to publish message:',
            err
          );
        }
      });
    } else {
      console.error(
        '[MqttSignalingClient] MQTT client not connected. Cannot send message:',
        payload
      );
    }
  }

  // --- 公共 API 方法 (与 WebSocket 版本完全相同) ---

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

  private _sendPing() {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = setInterval(() => {
      // 在我们的模型中，ping/pong 是应用层的心跳，所以继续发送
      this._sendMessage({
        event: '__ping',
        data: {
          timestamp: new Date().getTime(),
        },
      });
    }, 20000);
  }

  public isConnected(): boolean {
    return this.connected && this.client?.connected === true;
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

  // 对于 MQTT，clientId 已经标识了 viewer，此消息主要用于触发服务器端的特定逻辑
  public registerViewerId(viewerId: string) {
    // 确保 this.meid 与 viewerId 一致
    if (this.meid !== viewerId) {
      console.warn(
        `MqttSignalingClient was initialized with meid '${this.meid}', but registerViewerId was called with '${viewerId}'. The clientId ('${this.meid}') will be used for communication.`
      );
    }
    const message: SignalPostMessage = {
      event: '__registerViewerId',
      data: { viewerId: this.meid },
    };
    this._sendMessage(message);
  }

  // 对于 MQTT，此消息用于通知服务器，此 clientId 是一个 "device"
  public registerDevice() {
    const message: SignalReceverMessage = {
      event: '_register',
      data: { peerId: this.meid },
    };
    this._sendMessage(message);
  }

  public sendCall(
    peerId: string,
    sessionId: string,
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
    this._sendMessage({
      event: '_offer',
      data: {
        ...this._buildBaseMessageData(),
        messageId: this._generateMessageId(),
        sdp,
        type: 'offer',
        state: 'successed',
        iceServers: '',
      },
    });
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
        bitrate,
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

  public disconnectSession() {
    this._sendMessage({
      event: '__disconnected',
      data: {
        ...this._buildBaseMessageData(),
        messageId: this._generateMessageId(),
      },
    });
  }
}
