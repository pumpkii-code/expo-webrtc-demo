/*
 * @Author: tonyYo
 * @Date: 2025-05-14 10:23:37
 * @LastEditors: tonyYo
 * @LastEditTime: 2025-05-15 18:13:55
 * @FilePath: /expo-webrtc-demo/ws.js
 */
const WebSocket = require('ws');
const port = 8910;
const wss = new WebSocket.Server({ port });

const userMap = {};
const connections = {
  // [viewId]:[masterId]
};
const connectionsData = {};
// 存储所有设备端的信息
const devicesMap = {};

const formatMessage = (eventName, data, ws) => {
  const { sessionId, messageId, sessionType, from, to } = data;
  let formatData = {};

  switch (eventName) {
    case '__connectto':
      // 存储用户信息
      ws.peerId = from;
      userMap[from] = ws;

      // State： 需要访问的设备号的在线状态：online，offline
      // iceServers：服务器下发的 iceServers 的地址。创建webrtc 使用这个地址创建。并且再后面的 call 命令中发给设备端。
      formatData = {
        eventName: '_create',
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
        eventName: '__call',
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
        eventName: '_offer',
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
        eventName: '__answer',
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
        eventName: '__ice_candidate',
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
        eventName: '_ice_candidate',
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
        eventName: '__code_rate',
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
      console.warn('未知事件', eventName);
      break;
  }

  return formatData;
};

const iceservers = '{"iceServers":[{"urls":"stun:stun.l.google.com:19302"}]}',
  iceServers =
    '{"iceServers":[{"urls":"stun:stun.l.google.com:19302","username":"qq-kan","credential":"1544115907"}],"iceTransportPolicy":"all","iceCandidatePoolSize":"0"}',
  domainnameiceServers =
    '{"iceServers":[{"urls":"stun:stun.l.google.com:19302","username":"qq-kan","credential":"1544115907"}],"iceTransportPolicy":"all","iceCandidatePoolSize":"0"}';

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    const { eventName, data } = JSON.parse(message);
    console.log('Received message:', eventName);

    // 设备端注册 这个是例外, 没有额外的参数
    if (eventName === '_register') {
      ws.peerId = data.peerId;
      userMap[data.peerId] = ws;
      devicesMap[data.peerId] = {};
      console.log('设备端注册成功');

      // 如果有未完成的连接，发送给目标设备
      const waitingViewers = Object.keys(connections).filter(
        (viewerId) => connections[viewerId] === data.peerId
      );

      console.log('waitingViewers', data.peerId, waitingViewers);

      waitingViewers.forEach((viewerId) => {
        devicesMap[data.peerId][viewerId] = true;
        userMap[viewerId].send(JSON.stringify(connectionsData[viewerId]));
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

    const sendData = formatMessage(eventName, data, ws);

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
    if (eventName === '__connectto') {
      userMap[from].send(JSON.stringify(sendData));
      return;
    } else {
      if (userMap[to]) {
        userMap[to].send(JSON.stringify(sendData));
      } else {
        console.error('目标用户不在线', to);
      }
    }
  });

  ws.on('close', () => {
    // 清理断开的连接
    const peerId = ws.peerId;
    if (peerId && userMap[peerId]) {
      console.log(`Peer ${peerId} 断开连接`);

      if (devicesMap[peerId]) {
        // 通知所有设备端该用户已离线
        Object.keys(devicesMap[peerId]).forEach((client) => {
          if (userMap[client]) {
            userMap[client].send(
              JSON.stringify({
                eventName: '_offline',
                data: {
                  peerId: peerId,
                },
              })
            );
          }
        });
      }

      delete userMap[peerId];
      delete connections[peerId];
      delete connectionsData[peerId];
    }

    //如果是用户，则需要从
  });
});

console.log('ws____Signaling server running on ws://localhost: ' + port);
