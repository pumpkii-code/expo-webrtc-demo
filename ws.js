/*
 * @Author: tonyYo
 * @Date: 2025-05-14 10:23:37
 * @LastEditors: tonyYo
 * @LastEditTime: 2025-05-15 18:13:55
 * @FilePath: /expo-webrtc-demo/ws.js
 */
const { timeStamp } = require('console');
const http = require('http');
const WebSocket = require('ws');

const port = 8910;

// NEW: Create an HTTP server
const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/mio/t1') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });

    // --- 关键修正 ---
    // 将 Map 转换为普通对象再进行 JSON 序列化
    const devicesObject = Object.fromEntries(devicesMap);
    console.log(JSON.stringify(devicesObject, null, 2));
    res.end(JSON.stringify(devicesObject, null, 2));
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

const wss = new WebSocket.Server({ server });

const userMap = {};
const connections = {
  // [viewId]:[masterId]
};
const connectionsData = {};
// 存储所有设备端的信息
const devicesMap = new Map(); // <-- 变化: 初始化为真正的 Map

// ... (formatMessage 函数保持不变)
const formatMessage = (event, data, ws) => {
  // ... 此处代码无变化 ...
  const { sessionId, messageId, sessionType, from, to } = data;
  let formatData = {};

  switch (event) {
    case '__connectto':
      // 存储用户信息
      ws.peerId = from;
      userMap[from] = ws;

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

wss.on('connection', (ws) => {
  console.log('connection');
  ws.on('message', (message) => {
    const { event, data } = JSON.parse(message);
    console.log('Received message:', event);

    if (event === '_register') {
      ws.peerId = data.peerId;
      userMap[data.peerId] = ws;
      devicesMap.set(data.peerId, {}); // <-- 变化: 使用 .set() 方法
      console.log('设备端注册成功:', data.peerId);

      const waitingViewers = Object.keys(connections).filter(
        (viewerId) => connections[viewerId] === data.peerId
      );

      console.log('waitingViewers', data.peerId, waitingViewers);

      waitingViewers.forEach((viewerId) => {
        const viewersOfDevice = devicesMap.get(data.peerId); // <-- 变化: 使用 .get() 方法
        if (viewersOfDevice) {
          viewersOfDevice[viewerId] = true; // 子对象仍然是普通对象，操作不变
        }

        userMap[viewerId].send(JSON.stringify(connectionsData[viewerId]));
        delete connections[viewerId];
        delete connectionsData[viewerId];
      });
      return;
    }

    if (event === '__registerViewerId') {
      ws.peerId = data.viewerId;
      userMap[data.viewerId] = ws;
      return;
    }

    if (event === '__ping') {
      ws.send(
        JSON.stringify({
          event: '_pong',
          data: { timeStamp: new Date().getTime() },
        })
      );
      return;
    }

    // ... (其他事件处理部分无变化)
    const { sessionId, messageId, sessionType, from, to } = data;

    if (!sessionId || !messageId || !sessionType || !from || !to) {
      console.error('缺少必要参数');
      return;
    }

    const sendData = formatMessage(event, data, ws);

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
    console.log('close+______++:D');
    const peerId = ws.peerId;
    if (peerId) {
      // 简化判断
      console.log(`Peer ${peerId} 断开连接`);

      // <-- 变化: 使用 Map 的 API
      if (devicesMap.has(peerId)) {
        // 通知所有连接到此设备的用户，该设备已离线
        const viewers = devicesMap.get(peerId);
        if (viewers) {
          Object.keys(viewers).forEach((client) => {
            if (userMap[client]) {
              userMap[client].send(
                JSON.stringify({
                  event: '_offline',
                  data: { peerId: peerId },
                })
              );
            }
          });
        }
        // 清理设备
        devicesMap.delete(peerId);
        console.log(
          `Device ${peerId} and its connections cleared from devicesMap.`
        );
      }

      delete userMap[peerId];

      // 清理等待队列中的连接
      for (const fromId in connections) {
        if (connections[fromId] === peerId || fromId === peerId) {
          delete connections[fromId];
          delete connectionsData[fromId];
        }
      }
    }
  });
});

server.listen(port, () => {
  console.log(`HTTP and WebSocket server running on port: ${port}`);
  console.log(`- WebSocket endpoint: ws://localhost:${port}`);
  console.log(
    `- To query devicesMap, use: GET http://localhost:${port}/devices`
  );
});
