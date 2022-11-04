const express = require("express");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const morgan = require("morgan");
const routes = require("./routes/index.js");
const { Server } = require("socket.io");
const http = require("http");
const blackCards = require("./data/blackCards");
const whiteCards = require("./data/whiteCards");
const { User, Room } = require("./db.js");
const SocketServer = Server;
const {CORS_URL} = process.env

const server = express();
const cors=require("cors");

const app = http.createServer(server);

const io = new SocketServer(app, {
  cors: {
    origin: "https://hdp-game.vercel.app/",
  },
});
const rooms = {};
app.listen(process.env.PORT || 3002)

// se conecta primero cuando inicia la pagina
// una vez en el login tiene dos opciones crear sala -->se setea el usuario(nombre, imagen )
// --->crear publica---> valor contraseña: null
//                                                   --->privada--->contraseña elegida por el usuario ( se pasa por parametro la contraseña)

//                                     unirse a sala --->JoinRoom

// una vez en el joinRoom tiene opciones--->unirse sala random ( solo publicas )
//                                   --->elegir sala publica ->enviar al front el objeto rooms                             TODAS         con menos de 10 participantes
//                                   --->elegir sala privada ingresando codigo, chequeo de contraseña pasado por parametros
//                                   caso contrario envia un texto de error.

io.use((socket, next) => {
  console.log("entro al use perreque");
  next();
});

// ************** ESTO ES LA PARTE DEL CHAT PRIVADO ***************
// {idroom:{users:{...,...,abc21234(socket.id):Juan}   password:....    whitecards:[....]}} {}
//
io.on("connection", (socket) => {
  socket.emit("connection");

  console.log(socket.id);
  socket.on("user-created", ({ name, userPicture, idRoom }) => {
    // setea valores del usuario
    // const name = socket.handshake.auth.name;
    // const userPicture = socket.handshake.auth.userPicture;
    // const idRoom = socket.handshake.auth.idRoom;
    // console.log(name,userPicture,idRoom)
    socket.idRoom = idRoom;
    socket.name = name;
    socket.userPicture = userPicture;
  });
  socket.on("join-room", ({ idRoom }) => {
    // setea
    socket.idRoom = idRoom;
  });

  socket.on("new-user", (password) => {
    socket.join(socket.idRoom);
    if (!rooms[socket.idRoom]) {
      rooms[socket.idRoom] = {};
      rooms[socket.idRoom].whiteCards = [...whiteCards];
      rooms[socket.idRoom].blackCards = [...blackCards];
      rooms[socket.idRoom].users = {};
      rooms[socket.idRoom].status = "available"; // available (sala de espera)  /  unavailable (jugando/termino) /
      rooms[socket.idRoom].round = 0;
      /****************NUEVO***********************************/
      rooms[socket.idRoom].amountPlayers = 1;
      rooms[socket.idRoom].users[socket.id] = {
        name: socket.name,
        userPicture: socket.userPicture,
        points: 0, //donde se van sumando los puntos
        ownerRoom: true,
        ownCards: [],
      };
      rooms[socket.idRoom].playingCards = []; // cartas en juego de todos los jugadores
      rooms[socket.idRoom].kingRound = "";
      rooms[socket.idRoom].idsUsers = [socket.id];
      rooms[socket.idRoom].kingChoosing = false;
      rooms[socket.idRoom].blackCard = "";

      /****************FIN NUEVO***********************************/
      if (password) {
        rooms[socket.idRoom].privacy = "private";
        rooms[socket.idRoom].password = password;
      } else {
        rooms[socket.idRoom].privacy = "public";
        rooms[socket.idRoom].password = null; // si no le pasan el parametro la contraseña es null
      }
      io.emit("all-rooms", rooms);
    } else {
      rooms[socket.idRoom].amountPlayers =
        rooms[socket.idRoom].amountPlayers + 1;

      rooms[socket.idRoom].users[socket.id] = {
        name: socket.name,
        userPicture: socket.userPicture,
        points: 0, //donde se van sumando los puntos
        ownerRoom: false /****************NUEVO***********************************/,
        ownCards: [],
      };
      rooms[socket.idRoom].idsUsers = [
        ...rooms[socket.idRoom].idsUsers,
        socket.id,
      ];
    }

    socket
      .to(socket.idRoom)
      .emit("user-connected", { users: rooms[socket.idRoom].users }); //para los demas
      
  });

  socket.on("room-info", () => {
    console.log("entro a room info");
    socket.emit("room-info", rooms[socket.idRoom]); //para los mi
  });

  socket.on("send-chat-message", ({ message, room }) => {
    console.log(room, "room");
    console.log(socket.idRoom, "user room ");

    socket.to(room).emit("chat-message", {
      message: message,
      name: socket.name,
      userPicture: socket.userPicture,
    });
  });

  socket.on("disconnect", () => {
    console.log("me desconecte");

    getUserRooms(socket).forEach((room) => {
      // playerDisconnect(room);
      for (let i = 0; i < rooms[socket.idRoom].playingCards.length; i++) {
        if (rooms[socket.idRoom].playingCards[i].socketId === socket.id) {
          rooms[socket.idRoom].playingCards.splice(i, 1);
        }
      }
      if (rooms[socket.idRoom].kingRound === socket.id) {
        rooms[socket.idRoom].kingRound =
          rooms[socket.idRoom].idsUsers[
            (rooms[socket.idRoom].round + 1) %
              rooms[socket.idRoom].idsUsers.length
          ];
        for (let i = 0; i < rooms[socket.idRoom].playingCards.length; i++) {
          if (
            rooms[socket.idRoom].playingCards[i].socketId ===
            rooms[socket.idRoom].kingRound
          ) {
            rooms[socket.idRoom].playingCards.splice(i, 1);
          }
        }

        io.to(socket.idRoom).emit("king-round", {
          blackCard: rooms[socket.idRoom].blackCard,
          kingId: rooms[socket.idRoom].kingRound,
        });
        io.to(rooms[socket.idRoom].kingRound).emit("king-choose");
      }
      if (rooms[socket.idRoom].users[socket.id].ownerRoom) {
        let index = rooms[socket.idRoom].idsUsers.indexOf(socket.id); // obtenemos el index
        rooms[socket.idRoom].idsUsers.splice(index, 1); // 1 es la cantidad de elemento a eliminar
        if (rooms[socket.idRoom].idsUsers[0]) {
          let newOwnerRoom = rooms[socket.idRoom].idsUsers[0];
          rooms[socket.idRoom].users[newOwnerRoom].ownerRoom = true;
        }
      } else {
        let index = rooms[socket.idRoom].idsUsers.indexOf(socket.id); // obtenemos el index

        rooms[socket.idRoom].idsUsers.splice(index, 1); // 1 es la cantidad de elemento a eliminar
      }

      delete rooms[room].users[socket.id];

      io.to(room).emit("user-disconnected", {
        socketid: socket.id,
        users: rooms[socket.idRoom].users,
      }); //fal
      if (!Object.values(rooms[room].users)?.length) {
        //********************NUEVOOOOOO*****************/
        delete rooms[room];
      }
    });
  });

  socket.on("all-rooms", () => {
    socket.emit("all-rooms", rooms);
  });

  /****************NUEVO***********************************/

  // socket.on("start-game", ({ room }) => {
  //   //Aca esta validado que sea el owner pero tambien haganlo en el front
  //   if (rooms[socket.idRoom].users[socket.id].ownerRoom) {
  //     rooms[socket.idRoom].status = "unavailable";
  //     io.to(room).emit("start-game",true); // le avisamos a los jugadores que arranco el juego
  //     rooms[socket.idRoom].users[socket.id].
  //     setTimeout(io.to(socket.idRoom).emit("start-round"),5000)

  //   } else {
  //     return;
  //   }
  // });

  socket.on("play-cards", ({ room, card }) => {
    //CARDS tiene que ser un ARRAY para que en caso de que tenga que jugar 2 cartas es posible
    console.log("entre a jugar la carta");

    rooms[socket.idRoom].playingCards.push({
      card: card,
      name: socket.name,
      socketId: socket.id,
    });
    let index = rooms[socket.idRoom].users[socket.id].ownCards.indexOf(card);
    rooms[socket.idRoom].users[socket.id].ownCards.splice(index, 1);

    io.to(room).emit("play-card", rooms[socket.idRoom].playingCards);
    endPickingWhiteCards(rooms[socket.idRoom], false, socket.idRoom);
  });

  socket.on("asking-cards", () => {
    console.log("entro a asking cards");
    const cardsForUser = giveUserCards(
      rooms[socket.idRoom],
      10 - rooms[socket.idRoom]?.users[socket.id].ownCards?.length
    );
    //eliminamos del array general las cartas y se las asignamos al usuario en su propio array
    for (let i = 0; i < cardsForUser?.length; i++) {
      rooms[socket.idRoom].users[socket.id].ownCards.push(cardsForUser[i]);
    }
    // console.log('soy info', rooms[socket.idRoom].users[socket.id].ownCards )
    socket.emit(
      "asking-cards",
      rooms[socket.idRoom]?.users[socket.id].ownCards
    );
  });

  socket.on("out-of-room", () => {
    getUserRooms(socket).forEach((room) => {
      // playerDisconnect(room);

      if (rooms[socket.idRoom].users[socket.id].ownerRoom) {
        let index = rooms[socket.idRoom].idsUsers.indexOf(socket.id); // obtenemos el index
        rooms[socket.idRoom].idsUsers.splice(index, 1); // 1 es la cantidad de elemento a eliminar
        if (rooms[socket.idRoom].idsUsers[0]) {
          let newOwnerRoom = rooms[socket.idRoom].idsUsers[0];
          rooms[socket.idRoom].users[newOwnerRoom].ownerRoom = true;
        }
      } else {
        var index = rooms[socket.idRoom].idsUsers.indexOf(socket.id); // obtenemos el index

        rooms[socket.idRoom].idsUsers.splice(index, 1); // 1 es la cantidad de elemento a eliminar
      }

      delete rooms[room].users[socket.id];
      socket.leave(room);
      io.to(room).emit("user-disconnected", {
        socketid: socket.id,
        users: rooms[socket.idRoom].users,
      }); //fal
    });
  });
  socket.on("restart-game", () => {
    if (rooms[socket.idRoom].users[socket.id].ownerRoom !== true) {
      return;
    } else {
      io.to(socket.idRoom).emit("restart-game");
    }
  });

  socket.on("start-game", ({ room }) => {
    //Aca esta validado que sea el owner pero tambien haganlo en el front
    if (rooms[socket.idRoom].users[socket.id].ownerRoom) {
      rooms[socket.idRoom].status = "unavailable";
      io.to(room).emit("start-game", true); // le avisamos a los jugadores que arranco el juego
      let selectedroom = rooms[socket.idRoom];
      setTimeout(game, 5000, selectedroom, undefined, room);
      // setTimeout(emitStartRound,5000,socket.idRoom)

      return;
    } else {
      return;
    }
  });
  const emitStartRound = (idRoom) => {
    rooms[idRoom].whiteCards = [...whiteCards];
    rooms[idRoom].blackCards = [...blackCards];
    rooms[socket.idRoom].playingCards = []; // cartas en juego de todos los jugadores
    rooms[socket.idRoom].kingRound = "";
    rooms[socket.idRoom].kingChoosing = false;
    rooms[socket.idRoom].blackCard = "";
    rooms[idRoom].status = "available"; // available (sala de espera)  /  unavailable (jugando/termino) /
    rooms[idRoom].round = 0;
  };

  const game = (room, cardWinner, idRoom) => {
    if (!rooms[socket.idRoom]) {
      return;
    }
    console.log(cardWinner, "soy cardWinner");
    if (cardWinner) {
      // si le pasamos por parametro el cardwinner significa que la ronda empezo entonces le sumamos un punto al ganador
      room.users[cardWinner].points = room.users[cardWinner].points + 1;
      io.to(idRoom).emit("winner-card", { winner: cardWinner }); // para modificar el estado local en el cual renderizamos
      if (room.users[cardWinner].points === 5) {
        setTimeout(emitEndGame, 5000, idRoom, cardWinner);
        return;
      }
    }
    io.to(idRoom).emit("ask-for-cards");
    if (room.round === 0) {
      setTimeout(newRound, 7500, room, idRoom);
    } else {
      setTimeout(newRound, 3500, room, idRoom);
    }
  };
  const emitEndGame = (room, cardWinner) => {
    io.to(room).emit("end-game", rooms[room].users[cardWinner].name);

    rooms[room].whiteCards = [...whiteCards];
    rooms[room].blackCards = [...blackCards];
    rooms[room].status = "available"; // available (sala de espera)  /  unavailable (jugando/termino) /
    rooms[room].round = 0;
    rooms[room].playingCards = []; // cartas en juego de todos los jugadores
    rooms[room].kingRound = "";

    rooms[room].kingChoosing = false;
    rooms[room].blackCard = "";
    for (const key in rooms[room].users) {
      rooms[room].users[key].ownCards = [];
      rooms[room].users[key].points = 0;
    }
  };

  const newRound = (room, idRoom) => {
    if (!rooms[socket.idRoom]) {
      return;
    }
    room.kingRound = room.idsUsers[room.round % room.idsUsers.length];

    room.playingCards = [];
    let blackDeck = shuffle(room.blackCards);
    let blackCard = blackDeck.splice(0, 1);
    room.blackCard = blackCard;
    io.to(idRoom).emit("start-round", room);
    io.to(idRoom).emit("king-round", {
      blackCard: blackCard,
      kingId: room.kingRound,
    });
    io.to(room.kingRound).emit("king-choose");
    let roundNumber = room.round;
    setTimeout(endPickingWhiteCards, 40000, room, true, idRoom, roundNumber);
  };

  const endPickingWhiteCards = (room, roundFinished, idRoom, round) => {
    // voteRound
    console.log("votaron Todos1 ");
    if (!rooms[socket.idRoom]) {
      return;
    }
    if (
      room.playingCards.length === room.idsUsers.length - 1 &&
      roundFinished === false
    ) {
      // nos fijamos se todos dieron su carta
      console.log("votaron Todos 2");

      rooms[idRoom].kingChoosing = true;
      io.to(idRoom).emit("king-chooses");
      setTimeout(kingChoose, 25000, room, undefined, true, idRoom, round);
    } else {
      //
      if (
        roundFinished &&
        !rooms[idRoom].kingChoosing &&
        room.round === round
      ) {
        // a chequear
        console.log("votaron Todos3");
        rooms[idRoom].kingChoosing = true; // el rey elije la carta para que, cuando escuche cuando van entregando las cartas si le intentar enviar una fuera de tiempo no la recibe
        io.to(idRoom).emit("king-chooses");
        setTimeout(kingChoose, 25000, room, undefined, true, idRoom, round);
      }
    }
  };

  const kingChoose = (room, cardWinner, timeout, idRoom, round) => {
    console.log("entro a el king choose 1");
    if (!rooms[socket.idRoom]) {
      return;
    }
    if (timeout && room.kingChoosing === true && room.round === round) {
      room.round = room.round + 1;
      console.log("entro a el king choose 2");
      let usersPlaying = [...room.idsUsers];
      let index = usersPlaying.indexOf(room.kingRound);
      room.kingChoosing = false;

      usersPlaying.splice(index, 1);
      let randomindex = Math.round(Math.random() * (usersPlaying.length - 1));
      let winnerRandom = usersPlaying[randomindex];
      game(room, winnerRandom, idRoom);
    } else {
      if (!timeout && cardWinner) {
        room.round = room.round + 1;
        console.log("entro a el king choose 3");
        room.kingChoosing = false; // no lo esta poniendo en false
        game(room, cardWinner.socketId, idRoom);
      }
    }
  };

  socket.on("king-choice", (cardWinner) => {
    kingChoose(rooms[socket.idRoom], cardWinner, false, socket.idRoom);
  });
  //en el carwinner hay que enviarle todos los datos que hay en el usuario osea rooms.roomid.users.winnersSocket
});

// FALTAN COSASSSS PERO PUSHEO

/****************FIN DE ESPACIO PUBLICITARIO***********************************/


function giveUserCards(room, amount) {
  shuffle(room?.whiteCards); //array desordenado
  let userCards = room?.whiteCards.splice(0, amount); // saca la cantidad necesaria
  return userCards; // devuelve eso
} //        5
function shuffle(array) {
  var tmp,
    current,
    top = array?.length;
  // 5 true
  if (top)
    //5 -1 true
    while (--top) {
      //     0.9     *      5  =  4.50
      // 0
      current = Math.floor(Math.random() * (top + 1));
      // tmp = array[0]
      tmp = array[current];
      //array[0] = array[4]
      array[current] = array[top];
      // array[4] = array[0]
      array[top] = tmp;
    }

  return array;
}

function getUserRooms(socket) {
  return Object.entries(rooms).reduce((names, [name, room]) => {
    if (room.users[socket.id] != null) names.push(name);
    return names;
  }, []);
}

server.name = "API";
server.use(cors())

server.use(bodyParser.urlencoded({ extended: true, limit: "50mb" }));
server.use(bodyParser.json({ limit: "50mb" }));
server.use(cookieParser());
server.use(morgan("dev"));
server.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", CORS_URL); // update to match the domain you will make the request from
  res.header("Access-Control-Allow-Credentials", "true");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
  next();
});

server.use("/", routes);

// Error catching endware.
server.use((err, req, res, next) => {
  // eslint-disable-line no-unused-vars
  const status = err.status || 500;
  const message = err.message || err;
  console.error(err);
  res.status(status).send(message);
});

module.exports = app;
