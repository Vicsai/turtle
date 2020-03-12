const iceServers = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stunserver.org' }];
// const peer = new RTCPeerConnection(iceServers);
const socket = io.connect();
let peer;

const connections = {};
let inboundStream = null;

$(document).ready(() => {
  socket.emit('join');
  // $('#userPrompt').submit(e => {
  //   e.preventDefault();
  //   const username = $('#username').val();
  //   socket.emit('join', username);
  //   $('#prompt').hide();
  //   $('#screenshare').show();
  // });
});

// FUNCTION
async function startScreenShare() {
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
  const tracks = stream.getTracks();
  for (let i = 0; i < tracks.length; i++) {
    peer.addTrack(tracks[i], stream);
    // connections[id].addTrack(tracks[i], stream);
  }
  console.log('finished adding tracks');
  const video = document.getElementById('screen');
  video.srcObject = stream;
  video.play();
}

// SOCKET

socket.on('initiate', async ({ initiator, socketID }) => {
  console.log(socketID);
  peer = new RTCPeerConnection(iceServers);
  connections[socketID] = peer;
  peer.oniceconnectionstatechange = () => {
    console.log(`peer ice state ${peer.iceConnectionState}`);
  };
  peer.onicecandidate = e => {
    if (!e || !e.candidate) return;
    console.log(e);
    console.log(e.candidate);
    socket.emit('message', { candidate: e.candidate });
  };
  peer.ontrack = e => {
    if (initiator) return;
    const video = document.getElementById('screen');
    if (!inboundStream) {
      inboundStream = new MediaStream([e.track]);
    } else peer.addTrack(e.track, inboundStream);
    video.srcObject = inboundStream;
    e.track.onunmute = () => {
      video.play();
    };
  };
  if (initiator === true) {
    await startScreenShare();
    await peer.setLocalDescription(await peer.createOffer());
    socket.emit('message', { description: peer.localDescription, to: socketID });
  } else {
    console.log('finished viewer');
    socket.emit('initiateHost', { viewerID: socket.id });
  }
});
socket.on('message', async ({ description, candidate, id }) => {
  if (description) {
    if (description.type === 'offer') {
      console.log('recieved offer');
      await peer.setRemoteDescription(description);
      await peer.setLocalDescription(await peer.createAnswer());
      console.log('creating answer');
      socket.emit('message', { description: peer.localDescription, to: id });
    } else if (description.type === 'answer') {
      await peer.setRemoteDescription(description);
      console.log('answer recieved');
    } else console.log('unexpected description type');
  }
  if (candidate) {
    await peer.addIceCandidate(new RTCIceCandidate(candidate));
    console.log('ice candidate added');
  }
});
// socket.on('closeConnection', async id => {
//   if (connections[id]) {
//     connections[id].close();
//     console.log('connection closed');
//   } else console.log('invalid connection close');
// });

// initialize a new user when they join a room
// socket.on('initiate', async ({ host, id }) => {
//   connections[host] = new RTCPeerConnection(iceServers);
//   const peer = connections[host];
//   peer.oniceconnectionstatechange = () => {
//     console.log(`peer ice state ${peer.iceConnectionState}`);
//   };

//   peer.ontrack = e => {
//     if (initiator) return;
//     const video = document.getElementById('screen');
//     if (!inboundStream) {
//       inboundStream = new MediaStream([e.track]);
//     } else peer.addTrack(e.track, inboundStream);
//     video.srcObject = inboundStream;
//     e.track.onunmute = () => {
//       video.play();
//     };
//   };
//   peer.onnegotiationneeded = async e => {
//     await peer.setLocalDescriptionawait(peer.createOffer());
//     socket.emit('message', { description: peer.localDescription, to: id });
//   };
//   socket.emit('newUserReady', id);
// });
// create a new peer connection for host when a user joins the room
// socket.on('newHostPeer', async id => {
//   const peer = new RTCPeerConnection(iceServers);
//   connections[id] = peer;
//   console.log(connections);
//   console.log(id);
//   await startScreenShare(id);
//   initiator = true;
//   peer.oniceconnectionstatechange = () => {
//     console.log(`peer ice state ${peer.iceConnectionState}`);
//   };
//   peer.onicecandidate = e => {
//     if (!e || !e.candidate) return;
//     console.log(e);
//     console.log(e.candidate);
//     socket.emit('message', { description: peer.localDescription, candidate: e.candidate, to: id });
//   };
//   peer.onnegotiationneeded = async e => {
//     await peer.setLocalDescription(await peer.createOffer());
//     socket.emit('message', { description: peer.localDescription, to: id });
//   };
//   await peer.setLocalDescription(await peer.createOffer());
//   socket.emit('message', { description: peer.localDescription, to: id });
// });
