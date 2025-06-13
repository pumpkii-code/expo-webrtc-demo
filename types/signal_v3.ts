// 文件: src/types/signal_v2.ts

// --- 您提供的原始类型 ---

export interface BaseMessageData {
  sessionId: string;
  sessionType: 'IE';
  messageId: string;
  from: string;
  to: string;
}

export interface CallPostData {
  audio: string;
  video: string;
  datachannel: 'true' | 'false';
  iceservers: string;
  user: string;
  source: string;
  pwd: string;
  mode: string;
}

export interface AnswerPostData {
  sdp: string;
  type: RTCSdpType;
}

export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface IcePostData {
  candidate: string;
  sdpMid?: string;
  sdpMLineIndex?: number | null | string;
  label?: string | number;
}

export interface BitrateData {
  bitrate: number;
}

export type SignalPostMessage =
  // ... (保持您提供的完整定义)
  | { event: '__connectto'; data: BaseMessageData }
  | { event: '__registerViewerId'; data: { viewerId: string } }
  | { event: '__call'; data: BaseMessageData & CallPostData }
  | { event: '__ice_candidate'; data: BaseMessageData & IcePostData }
  | { event: '__answer'; data: BaseMessageData & AnswerPostData }
  | { event: '__disconnected'; data: BaseMessageData }
  | { event: '__code_rate'; data: BaseMessageData & BitrateData }
  | { event: '__offer'; data: BaseMessageData }
  | { event: '__ping'; data: { timestamp: number } };

export interface CreateReceverData {
  domainnameiceServers: string;
  iceServers: string;
  state: 'online' | 'offline' | string;
}

export interface IceCandidateReceverData {
  candidate: string;
  sdpMLineIndex?: number;
  label?: string;
}

export interface OfferReceverData {
  iceservers: string;
  state: 'successed';
  user?: string;
  sdp: string;
  type: RTCSdpType;
}

export interface PingReceverData {}

export interface ConnectInfoReceverData {
  candidate: string;
}

export interface DiconnectedReceverMessage {
  event: string;
  data: any;
}

export type SignalReceverMessage =
  // ... (保持您提供的完整定义)
  | { event: '_create'; data: BaseMessageData & CreateReceverData }
  | { event: '_offer'; data: BaseMessageData & OfferReceverData }
  | { event: '_ice_candidate'; data: BaseMessageData & IceCandidateReceverData }
  | { event: '_ping'; data: BaseMessageData & PingReceverData }
  | { event: '_connectinfo'; data: BaseMessageData & ConnectInfoReceverData }
  | {
      event: '_disconnected';
      data: BaseMessageData & DiconnectedReceverMessage;
    }
  | { event: '_register'; data: { peerId: string } }
  | { event: '_offline'; data: { peerId: string } }
  | { event: '__ice_candidate'; data: BaseMessageData & IcePostData }
  | { event: '_pong'; data: { timestamp: number } };

export interface CallOptions {
  datachannelEnable?: boolean;
  audioEnable?: 'recvonly';
  videoEnable?: 'recvonly';
  user?: string;
  pwd?: string;
  iceServers?: string;
}

// ... (其他 RTCStats 类型也保持不变)

// --- 新增：事件负载的类型映射 ---
// 这个接口是实现类型安全事件监听的关键。
// 我们将 SignalingCallbacks 的方法名转换为事件名。

// 这是 _create 事件的专用数据类型，因为我们处理了 iceServers
export type CreateEventData = Omit<
  BaseMessageData & CreateReceverData,
  'iceServers'
> & { iceServers: string };

export interface EventPayloads {
  // 连接状态事件
  connected: void;
  disconnected: string; // 参数是断开连接的原因
  error: any; // 参数是错误对象或信息

  // 从服务器收到的信令事件 (映射自 SignalingCallbacks)
  call: BaseMessageData & CallPostData;
  answer: BaseMessageData & AnswerPostData;
  create: CreateEventData;
  offer: BaseMessageData & OfferReceverData;
  deviceIceCandidate: BaseMessageData & IceCandidateReceverData;
  clientIceCandidate: BaseMessageData & IcePostData;
  changeBitrate: BaseMessageData & BitrateData;

  // 其他服务器事件
  pong: void;
  offline: { peerId: string };
  connectinfo: BaseMessageData & ConnectInfoReceverData;
  peerDisconnected: BaseMessageData & DiconnectedReceverMessage;
}
