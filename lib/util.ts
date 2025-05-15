/*
 * @Author: tonyYo
 * @Date: 2025-05-14 18:30:21
 * @LastEditors: tonyYo
 * @LastEditTime: 2025-05-14 18:30:37
 * @FilePath: /expo-webrtc-demo/lib/util.ts
 */
export function newGuid() {
    let s4 = function () {
        return ((65536 * (1 + Math.random())) | 0).toString(16).substring(1);
    };
    return (
        s4() +
        s4() +
        "-" +
        s4() +
        "-4" +
        s4().substr(0, 3) +
        "-" +
        s4() +
        "-" +
        s4() +
        s4() +
        s4()
    ).toUpperCase();
}