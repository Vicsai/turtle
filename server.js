const express = require('express');
// const fs = require('fs');

// const serverOptions = {
//   key: fs.readFileSync('key.pem'),
//   cert: fs.readFileSync('cert.pem')
// };

const app = express();

// const https = require('https').createServer(serverOptions, app);
// const io = require('socket.io')(https);

const http = require('http').createServer(app);
const io = require('socket.io')(http);

const rooms = {};
let room;

app.use(express.static(`${__dirname}/public`));
app.get('/', (req, res) => {
  res.sendFile(`${__dirname}/public/index.html`);
});
app.get('/favicon.ico', (req, res) => res.status(204));
app.post('/:roomid', (req, res) => {
  room = req.params.roomid;
  res.sendFile(`${__dirname}/public/screenshare.html`);
});

// FUNCTIONS
function joinRoom(socket) {
  if (Object.prototype.hasOwnProperty.call(rooms, socket.room)) {
    rooms[socket.room].push(socket.id);
    const host = rooms[socket.room][0];
    socket.host = host;
    socket.to(host).emit('initiator', socket.id);
  } else {
    rooms[socket.room] = [socket.id];
  }
}
function leaveRoom(socket) {
  const index = rooms[socket.room].indexOf(socket.id);
  if (index !== -1) rooms[socket.room].splice(index, 1);
  console.log(`${socket.username} has left`);
}

// SOCKETS
io.sockets.on('connection', socket => {
  socket.on('join', username => {
    socket.username = username;
    socket.room = room;
    joinRoom(socket);
    console.log(`${socket.username} has joined`);
  });
  socket.on('disconnect', () => {
    if (socket.username === undefined) {
      console.log('left without joining');
    } else {
      leaveRoom(socket);
      if (rooms[socket.room] === undefined || rooms[socket.room].length === 0) {
        console.log(`removed room ${socket.room}`);
        delete rooms[socket.room];
      }
    }
  });
  socket.on('message', data => {
    if (data.candidate) {
      socket.to(data.to).emit('message', { candidate: data.candidate, socket: socket.id });
    } else {
      socket.to(data.to).emit('message', {
        description: data.description,
        socket: socket.id
      });
    }
  });
  socket.on('renegotiate', data => {
    console.log('renegotiating...');
    socket.broadcast.emit('newSDP', data.sdp);
  });
});
http.listen(8000, () => {
  console.log('start server on 8000');
});
