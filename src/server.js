const http = require("http");
const app = require("./app");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const User = require("./models/userModel");

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL,
    methods: ["GET", "POST"]
  }
});

app.set("io", io);
global.io = io;

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error("Authentication required"));
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    const user = await User.findById(decoded.id).select("_id isAdmin");

    if (!user) {
      return next(new Error("User not found"));
    }

    socket.user = {
      id: user._id.toString(),
      isAdmin: user.isAdmin
    };

    next();

  } catch (error) {
    next(new Error("Invalid token"));
  }
});

io.on("connection", (socket) => {

  console.log("Socket connected:", socket.id);

  socket.on("joinAdmin", () => {
    if(!socket.user?.isAdmin){
      return;
    }

    socket.join("admins");

    console.log("Admin joined");
  });

  socket.on("joinUser", () => {
    if(!socket.user?.id){
      return;
    }

    socket.join(socket.user.id);

    console.log("User joined:", socket.user.id);
  });

});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});