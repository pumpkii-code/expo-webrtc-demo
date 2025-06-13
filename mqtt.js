/*
 * @Author: tonyYo
 * @Date: 2025-06-11 15:36:10
 * @LastEditors: tonyYo
 * @LastEditTime: 2025-06-11 15:37:18
 * @FilePath: /expo-webrtc-demo/mqtt.js
 */

/**
 * 运行mosquitto
docker run \
  -it \
  -d \
  --name my-webrtc-mosquitto \
  -p 1883:1883 \
  -p 9001:9001 \
  -v /Volumes/HIKSEMI/web-test/WebRTC-1/expo-webrtc-demo/mosquitto.conf:/mosquitto/config/mosquitto.conf \
  -v /Volumes/HIKSEMI/web-test/WebRTC-1/expo-webrtc-demo/data:/mosquitto/data \
  -v /Volumes/HIKSEMI/web-test/WebRTC-1/expo-webrtc-demo/log:/mosquitto/log \
  eclipse-mosquitto:latest
 */
const mqtt = require('mqtt');
const port = 1883;
const brokerUrl = `mqtt://localhost:${port}`;

// MQTT 客户端连接
const client = mqtt.connect(brokerUrl);

const userMap = {};
const connections = {
  // [viewId]:[masterId]
};
const connectionsData = {};
// 存储所有设备端的信息
const devicesMap = {};

// MQTT 主题定义
const TOPICS = {
  REGISTER: 'webrtc/register',
  CONNECT: 'webrtc/connect',
  CALL: 'webrtc/call',
  OFFER: 'webrtc/offer',
  ANSWER: 'webrtc/answer',
  ICE_CANDIDATE: 'webrtc/ice_candidate',
  CODE_RATE: 'webrtc/code_rate',
  OFFLINE: 'webrtc/offline',
};

const formatMessage = (event, data, clientId) => {
  const { sessionId, messageId, sessionType, from, to } = data;
  let formatData = {};

  switch (event) {
    case '__connectto':
      // 存储用户信息
      userMap[from] = clientId;

      // State： 需要访问的设备号的在线状态：online，offline
      // iceServers：服务器下发的 iceServers 的地址。创建webrtc 使用这个地址创建。并且再后面的 call 命令中发给设备端。
      formatData = {
        event: '_create',
        data: {
          // domainnameiceServers: domainnameiceServers,
          from: to,
          iceservers: iceServers,
          messageId: messageId,
          sessionId: sessionId,
          sessionType: sessionType,
          state: 'online',
          to: from,
          iceServers: iceServers,
        },
      };
      break;

    case '__call':
      if (!userMap[to]) {
        console.error('设备未开机');
        return;
      }
      const { audio, datachannel, mode, pwd, source, user, video } = data;
      formatData = {
        event: '__call',
        data: {
          audio: audio,
          datachannel: datachannel,
          from: from,
          iceservers: iceServers,
          messageId: messageId,
          mode: mode,
          pwd: pwd,
          sessionId: sessionId,
          sessionType: sessionType,
          source: source,
          state: 'successed',
          to: to,
          user: user,
          video: video,
        },
      };
      break;

    case '_offer':
      const {} = data;
      formatData = {
        event: '_offer',
        data: {
          audio: '',
          datachannel: '',
          from: from,
          iceservers: iceServers,
          messageId: messageId,
          mode: '',
          pwd: '',
          sdp: data.sdp,
          sessionId: sessionId,
          sessionType: sessionType,
          source: '',
          state: 'successed',
          to: to,
          type: 'offer',
          user: '',
          video: '',
        },
      };
      break;

    case '__answer':
      const { sdp } = data;
      formatData = {
        event: '__answer',
        data: {
          from: from,
          messageId: messageId,
          sdp: sdp,
          sessionId: sessionId,
          sessionType: sessionType,
          to: to,
          type: 'answer',
        },
      };
      break;

    case '__ice_candidate':
      formatData = {
        event: '__ice_candidate',
        data: {
          candidate: data.candidate,
          from: from,
          messageId: messageId,
          sessionId: sessionId,
          sessionType: sessionType,
          to: to,
        },
      };
      break;

    case '_ice_candidate':
      formatData = {
        event: '_ice_candidate',
        data: {
          candidate: data.candidate,
          from: from,
          messageId: messageId,
          sessionId: sessionId,
          sessionType: sessionType,
          to: to,
        },
      };
      break;

    case '__code_rate':
      formatData = {
        event: '__code_rate',
        data: {
          from: from,
          messageId: messageId,
          sessionId: sessionId,
          sessionType: sessionType,
          to: to,
          bitrate: data.bitrate,
        },
      };
      break;

    default:
      console.warn('未知事件', event);
      break;
  }

  return formatData;
};

const iceservers = '{"iceServers":[{"urls":"stun:stun.l.google.com:19302"}]}',
  iceServers =
    '{"iceServers":[{"urls":"stun:stun.l.google.com:19302","username":"qq-kan","credential":"1544115907"}],"iceTransportPolicy":"all","iceCandidatePoolSize":"0"}',
  domainnameiceServers =
    '{"iceServers":[{"urls":"stun:stun.l.google.com:19302","username":"qq-kan","credential":"1544115907"}],"iceTransportPolicy":"all","iceCandidatePoolSize":"0"}';

// 发布消息到指定主题
const publishMessage = (topic, message) => {
  client.publish(topic, JSON.stringify(message), { qos: 1 }, (err) => {
    if (err) {
      console.error('发布消息失败:', err);
    }
  });
};

// 发送消息给特定用户
const sendToUser = (userId, message) => {
  const userTopic = `webrtc/user/${userId}`;
  publishMessage(userTopic, message);
};

// MQTT 连接成功
client.on('connect', () => {
  console.log('MQTT broker 连接成功');

  // 订阅所有相关主题
  Object.values(TOPICS).forEach((topic) => {
    client.subscribe(topic, { qos: 1 });
  });

  // 订阅用户主题的通配符
  client.subscribe('webrtc/user/+', { qos: 1 });

  console.log('已订阅所有 WebRTC 主题');
});

// 处理接收到的消息
client.on('message', (topic, message) => {
  try {
    const { event, data, clientId } = JSON.parse(message.toString());
    console.log('Received message:', event, 'from topic:', topic);

    // 设备端注册 这个是例外, 没有额外的参数
    if (event === '_register') {
      userMap[data.peerId] = clientId;
      devicesMap[data.peerId] = {};
      console.log('设备端注册成功:', data.peerId);

      // 如果有未完成的连接，发送给目标设备
      const waitingViewers = Object.keys(connections).filter(
        (viewerId) => connections[viewerId] === data.peerId
      );

      console.log('waitingViewers', data.peerId, waitingViewers);

      waitingViewers.forEach((viewerId) => {
        devicesMap[data.peerId][viewerId] = true;
        sendToUser(viewerId, connectionsData[viewerId]);
        delete connections[viewerId];
        delete connectionsData[viewerId];

        console.log(
          '清除所有等待该设备的连接__connections',
          JSON.stringify(connections)
        );
        console.log(
          '清除所有等待该设备的连接__connectionsData',
          JSON.stringify(connectionsData)
        );
      });
      return;
    }

    // 其他事件 是包含这些所有参数的
    const { sessionId, messageId, sessionType, from, to } = data;

    if (!sessionId || !messageId || !sessionType || !from || !to) {
      console.error('缺少必要参数');
      return;
    }

    const sendData = formatMessage(event, data, clientId);

    if (!sendData) {
      console.error('发送数据为空');
      return;
    }

    if (!userMap[to]) {
      connections[from] = to;
      connectionsData[from] = sendData;

      console.log('connections', JSON.stringify(connections));
      console.log('connectionsData', JSON.stringify(connectionsData));
      console.error('设备不在线', to);
      return;
    }

    // 统一转发
    if (event === '__connectto') {
      sendToUser(from, sendData);
      return;
    } else {
      if (userMap[to]) {
        sendToUser(to, sendData);
      } else {
        console.error('目标用户不在线', to);
      }
    }
  } catch (error) {
    console.error('处理消息时出错:', error);
  }
});

// 处理用户离线
const handleUserOffline = (peerId) => {
  console.log(`Peer ${peerId} 断开连接`);

  if (devicesMap[peerId]) {
    // 通知所有设备端该用户已离线
    Object.keys(devicesMap[peerId]).forEach((client) => {
      if (userMap[client]) {
        sendToUser(client, {
          event: '_offline',
          data: {
            peerId: peerId,
          },
        });
      }
    });
  }

  delete userMap[peerId];
  delete connections[peerId];
  delete connectionsData[peerId];
  delete devicesMap[peerId];
};

// 监听离线消息
client.on('message', (topic, message) => {
  if (topic === TOPICS.OFFLINE) {
    try {
      const { peerId } = JSON.parse(message.toString());
      handleUserOffline(peerId);
    } catch (error) {
      console.error('处理离线消息时出错:', error);
    }
  }
});

// MQTT 连接错误处理
client.on('error', (error) => {
  console.error('MQTT 连接错误:', error);
});

// MQTT 连接断开处理
client.on('close', () => {
  console.log('MQTT 连接已断开');
});

console.log('MQTT Signaling server running on mqtt://localhost:' + port);

// 导出一些有用的函数供外部使用
module.exports = {
  client,
  publishMessage,
  sendToUser,
  handleUserOffline,
  TOPICS,
};
