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
    console.log(`${socket.host} is host and ${socket.id} is viewer`);
    socket.emit('initiate', { host: socket.host, id: socket.id });
  } else {
    console.log('room created');
    rooms[socket.room] = [socket.id];
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
  socket.on('message', ({ description, candidate, to }) => {
    console.log(`${socket.username} is sending ${description} and ${candidate} to ${to}`);
    if (candidate) {
      socket.to(to).emit('message', {
        description,
        candidate,
        id: socket.id
      });
    } else {
      socket.to(to).emit('message', { description, id: socket.id });
    }
  });
  socket.on('newUserReady', id => {
    socket.to(socket.host).emit('newHostPeer', id);
  });
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
