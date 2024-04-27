import fs from "fs";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
const app = express();
const server = createServer(app);
const offers = [];
const sockets = [];
let allUniqueUsers = new Set();
const io = new Server(server, {
  cors: {
    origin: [
      "http://127.0.0.1:5500",
      "http://192.168.137.1",
      "http://192.168.137.130",
    ],
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  socket.on("find-partner", async (data) => {
    console.log(`listening to the find-partner event on the server side ${JSON.stringify(socket.handshake.auth)}  \n`);
    const allActiveSockets = await io.fetchSockets();

    for (const i of allActiveSockets) {
      console.log(i.handshake.auth.randomId , "randomId in loop" , socket.handshake.auth.randomId , " current random Id")
      if (i.handshake.auth.randomId !== socket.handshake.auth.randomId && socket.inRoom === undefined ) {
        const allRooms = io.sockets.adapter.rooms;
        if (!i.inRoom) {
          createRoom(socket, i);
        }
      }
    }
  });


  if (offers.length) {
    socket.emit("availableOffers" , offers);
  }

  socket.on("newOffer", async (data) => {
    //where to send this???

    offers.push({
      offeredRandomId: socket.handshake.auth.randomId,
      offer: data,
      offerIceCandidate: [],
      answererUserName: null,
      answer: null,
      answererIceCandidates: []
    });

    
    //socket.broadcast.emit send to all connected sockets except the caller 
    socket.broadcast.emit("newOfferAwaiting", offers.slice(-1) );

    
  });

  socket.on("new-ice-candidate", (data) => {
    //where to send this???
    //send the delivered ice candidate information to the target ( also there in the data)
    console.log(`listening to new-ice-candidate event on the server \n`)
    socket.emit("new-ice-candidate", data);
  });

  socket.on("video-answer", async (data) => {
    const allActiveSockets = await io.fetchSockets();
    for (const i of allActiveSockets) {
      if (i.handshake.auth.randomId === data.randomId) {
        i.emit("video-answer", data);
      }
    }
  });

  

});

function createRoom(callerSocketObject, calleeSocketObject) {
  let currentRandomId = callerSocketObject.handshake.auth.randomId;
  let randomId = calleeSocketObject.handshake.auth.randomId;

  let roomName =
    currentRandomId > randomId
      ? `${currentRandomId}:${randomId}`
      : `${randomId}:${currentRandomId}`;

  callerSocketObject.join(roomName);
  calleeSocketObject.join(roomName);
  callerSocketObject.inRoom = true;
  calleeSocketObject.inRoom = true;

  io.to(roomName).emit("room-joined", {
    roomName: roomName,
    participants: [
      {
        randomId: currentRandomId,
        type: "sender",
      },
      { randomId: randomId, type: "receiver" },
    ],
  });
}

const PORT = 5010;

server.listen(PORT, () => {
  console.log(`server listening on port ${PORT} `);
});
