const iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];
// const peer = new RTCPeerConnection(iceServers);
const socket = io.connect();

const connections = {};
let inboundStream = null;
let initiator = false;

$(document).ready(() => {
  $('#userPrompt').submit(e => {
    e.preventDefault();
    const username = $('#username').val();
    socket.emit('join', username);
    $('#prompt').hide();
    $('#screenshare').show();
  });
});

// FUNCTION
async function startScreenShare(id) {
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
  const tracks = stream.getTracks();
  for (let i = 0; i < tracks.length; i++) {
    connections[id].addTrack(tracks[i], stream);
  }
  console.log('finished adding tracks');
  const video = document.getElementById('screen');
  video.srcObject = stream;
  video.play();
}

// SOCKET
socket.on('initiate', async ({ host, id }) => {
  connections[host] = new RTCPeerConnection(iceServers);
  connections[host].oniceconnectionstatechange = () => {
    console.log(`peer ice state ${connections[host].iceConnectionState}`);
  };
  connections[host].ontrack = e => {
    if (initiator) return;
    const video = document.getElementById('screen');
    if (!inboundStream) {
      inboundStream = new MediaStream([e.track]);
    } else connections[host].addTrack(e.track, inboundStream);
    video.srcObject = inboundStream;
    e.track.onunmute = () => {
      video.play();
    };
  };
  socket.emit('newUserReady', id);
});
socket.on('r', async id => {
  const peer = new RTCPeerConnection(iceServers);
  connections[id] = peer;
  await startScreenShare(id);
  initiator = true;
  peer.oniceconnectionstatechange = () => {
    console.log(`peer ice state ${peer.iceConnectionState}`);
  };
  peer.onicecandidate = e => {
    socket.emit('message', { description: peer.localDescription, candidate: e.candidate, to: id });
  };
  await peer.setLocalDescription(await peer.createOffer());
  socket.emit('message', { description: peer.localDescription, to: id });
});
socket.on('closeConnection', async id => {
  if (connections[id]) {
    connections[id].close();
    console.log('connection closed');
  } else console.log('invalid connection close');
});
socket.on('message', async ({ description, candidate, id }) => {
  const peer = connections[id];
  if (description) {
    await peer.setRemoteDescription(description);
    if (description.type === 'offer') {
      console.log(peer.remoteDescription);
      await peer.setLocalDescription(await peer.createAnswer());
      socket.emit('message', { description: peer.localDescription, to: id });
    } else if (description.type === 'answer') console.log(peer.remoteDescription);
    else console.log('unexpected description type');
  }
  if (candidate) {
    console.log('ice candidate added');
    await peer.addIceCandidate(candidate);
  }
});

// socket.on('initiate', async () => {
//   await startScreenShare();
//   initiator = true;
//   console.log('initiate host');
//   await peer.setLocalDescription(await peer.createOffer());
// });
