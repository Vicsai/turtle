const express = require('express');

const app = express();

const http = require('http').createServer(app);
const io = require('socket.io')(http);

const port = process.env.PORT || 8000;
const rooms = {};
let room;
let username;

app.use(express.static(`${__dirname}/public`));
app.use(express.urlencoded());
app.get('/', (req, res) => {
  res.sendFile(`${__dirname}/public/index.html`);
});
app.get('/favicon.ico', (req, res) => res.status(204));
app.post('/:roomid', (req, res) => {
  room = req.params.roomid;
  username = req.body.username;
  res.sendFile(`${__dirname}/public/screenshare.html`);
});
const server = http.listen(port, () => {
  console.log(`Listening on ${port}`);
});

// FUNCTIONS
function joinRoom(socket) {
  if (Object.prototype.hasOwnProperty.call(rooms, socket.room)) {
    rooms[socket.room].push(socket.id);
    const host = rooms[socket.room][0];
    socket.host = host;
    socket.emit('initiate', {
      initiator: false,
      socketID: socket.id,
      socketUsername: socket.username
    });
  } else {
    console.log('room created');
    rooms[socket.room] = [socket.id];
    socket.emit('initiate', {
      initiator: true,
      socketID: socket.id,
      socketUsername: socket.username
    });
  }
  console.log(`${socket.username} has joined`);
}
function leaveRoom(socket) {
  const index = rooms[socket.room].indexOf(socket.id);
  if (index !== -1) {
    rooms[socket.room].splice(index, 1);
  }
  console.log(`${socket.username} has left`);
}

// SOCKETS
io.sockets.on('connection', socket => {
  socket.on('join', () => {
    socket.username = username;
    socket.room = room;
    joinRoom(socket);
  });
  socket.on('disconnect', () => {
    if (socket.username === undefined) {
      console.log('left without joining');
    } else {
      leaveRoom(socket);
      if (rooms[socket.room] === undefined || rooms[socket.room].length === 0) {
        console.log(`removed room ${socket.room}`);
        delete rooms[socket.room];
      } else {
        socket.to(socket.host).emit('closeConnection', socket.id);
      }
    }
  });
  socket.on('message', ({ description, candidate, message, to }) => {
    if (candidate !== undefined) {
      socket.broadcast.emit('message', {
        candidate
      });
    } else if (description !== undefined) {
      socket.broadcast.emit('message', { description });
    } else if (message !== undefined) {
      socket.broadcast.emit('newChatMessage', { username: socket.username, message });
    } else console.log('message fail');
  });
  // socket.on('initiateHost', ({ viewerID }) => {
  //   socket
  //     .to(socket.host)
  //     .emit('initiate', { initiator: true, socketID: viewerID, socketUsername: socket.username });
  // });
});
process.on('SIGTERM', () => {
  console.log('shutting down server');
  server.close(() => {
    console.log('server has shut down');
    process.exit(0);
  });
});
process.on('SIGINT', () => {
  console.log('shutting down server');
  server.close(() => {
    console.log('server has shut down');
    process.exit(0);
  });
});
